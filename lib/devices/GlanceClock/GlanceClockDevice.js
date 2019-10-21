const util = require("util");

const Device = require("../Device");
const Types = require("./Types");
const MqttHandler = require("./MqttHandler");

/**
 *
 * @param options
 * @constructor
 */
const GlanceClockDevice = function GlanceClockDevice(options) { //TODO: rewrite every hci access to use this.semaphore
    Device.call(this, options);

    this.deviceInterface = null;
    this.settingsCharacteristicInterface = null;

    this.mqttHandler = new MqttHandler({glanceClockDevice: this});
};

util.inherits(GlanceClockDevice, Device);

//This class needs to check the connection status on every action which is performed and should try to connect if it isn't
//Also, everything should fail if the class isn't initialized

GlanceClockDevice.prototype.initialize = function(callback) {
    this.blueZservice.getInterface(
        this.pathRoot + "/dev_" + this.macInDbusNotation,
        "org.bluez.Device1",
        (err, deviceInterface) => {
            if(!err && deviceInterface) {
                deviceInterface.Paired((err, isPaired) => {
                    if(!err && isPaired === true) {
                        this.deviceInterface = deviceInterface;

                        this.mqttClient.subscribe([
                            this.mqttHandler.topics.notify
                        ], {}, err => {
                            callback(err);
                        });
                    } else {
                        if(err) {
                            callback(Array.isArray(err) ? err.join(".") : err);
                        } else {
                            callback(new Error("GlanceClock needs to be paired with " + this.hciDevice))
                        }
                    }
                })
            } else {
                callback(Array.isArray(err) ? err.join(".") : err);
            }
        }
    );
};

GlanceClockDevice.prototype.handleMqttMessage = function(topic, message) {
    this.mqttHandler.handleMessage(topic, message);
};

//This ensures that the device is connected and the gattCharacteristic exists
GlanceClockDevice.prototype.executionHelper = function(callback) {
    const self = this;
    let retryCount = 0;

    function executionHelperHelper(callback) { //This. Name.
        self.semaphore.take(() => {
            self.deviceInterface.Connect(err => {
                self.semaphore.leave();

                if(!err) {
                    if(self.settingsCharacteristicInterface) {
                        callback();
                    } else {
                        self.blueZservice.getInterface(
                            self.pathRoot + "/dev_" + self.macInDbusNotation + "/service001d/char001e",
                            "org.bluez.GattCharacteristic1",
                            (err, settingsCharacteristicInterface) => {
                                err = Array.isArray(err) ? err.join(".") : err;

                                if(!err) {
                                    self.settingsCharacteristicInterface = settingsCharacteristicInterface;
                                    callback();
                                } else {
                                    if(retryCount < 10) {
                                        retryCount++;

                                        console.info("ExecutionHelper: Got Error " + err + " Retrying for " + self.friendlyName);
                                        executionHelperHelper(callback);
                                    } else {
                                        callback(err);
                                    }
                                }
                            }
                        )
                    }
                } else {
                    err = Array.isArray(err) ? err.join(".") : err;

                    if(retryCount < 10) {
                        retryCount++;

                        console.info("ExecutionHelper: Got Error " + err + " Retrying for " + self.friendlyName);
                        executionHelperHelper(callback);
                    } else {
                        console.info("ExecutionHelper: Retries exceeded for " + self.friendlyName);
                        callback(err);
                    }
                }
            });
        });
    }

    if(this.deviceInterface) {
        executionHelperHelper(callback);
    } else {
        callback(new Error("GlanceClockDevice has not been initialized."));
    }
};

/**
 *
 * @param command Array<number> //0-255 only
 * @param payload Array<number> //0-255 only
 * @param callback
 */
GlanceClockDevice.prototype.executeCommand = function(command, payload, callback) {
    const self = this;
    let retryCount = 0;

    function executeCommandHelper(command, payload, callback) {
        self.executionHelper(err => {
            if(!err) {
                let value = command;
                const options = {type: "request"};

                if(Array.isArray(payload)) {
                    value = command.concat(payload);
                }

                self.semaphore.take(() => {
                    self.settingsCharacteristicInterface.WriteValue(value, options, err => {
                        self.semaphore.leave();
                        err = Array.isArray(err) ? err.join(".") : err;

                        if(err) {
                            if(retryCount < 5) {
                                retryCount++;

                                console.info("ExecuteCommand: Got Error " + err + " Retrying for " + self.friendlyName);
                                executeCommandHelper(command, payload, callback);
                            } else {
                                console.info("ExecuteCommand: Retries exceeded for " + self.friendlyName);
                                callback(err);
                            }
                        } else {
                            callback()
                        }
                    });
                });
            } else {
                callback(err);
            }
        })
    }

    if(Array.isArray(command) && command.length > 0) {
        executeCommandHelper(command, payload, callback)
    } else {
        callback(new Error("Missing command"))
    }
};

GlanceClockDevice.prototype.updateAndRefresh = function(callback) {
    this.executeCommand([35], [], callback);
};


GlanceClockDevice.prototype.getSettings = function(callback) {
    this.executionHelper(err => {
        if(!err) {
            this.semaphore.take(() => {
                this.settingsCharacteristicInterface.ReadValue({}, (err, settingsBuf) => {
                    this.semaphore.leave();

                    if(!err) {
                        try {
                            callback(null, Types.Settings.decode(settingsBuf));
                        } catch(e) {
                            callback(e);
                        }
                    } else {
                        callback(Array.isArray(err) ? err.join(".") : err);
                    }
                })
            });
        } else {
            callback(err);
        }
    })
};


GlanceClockDevice.prototype.setSettings = function(settings, callback) {
    const command = [0x05,0x00,0x00,0x00];
    const payload = [...Types.Settings.encode(settings).finish()];

    this.executeCommand(command, payload, callback);
};

/**
 * @param options {object}
 * @param options.notice {Notice}
 * @param [options.priority] {number}
 * @param [options.source] {number}
 * @param callback
 */
GlanceClockDevice.prototype.notify = function(options, callback) {
    const priority = options.priority !== undefined ? options.priority : 16;
    const source = options.source !== undefined ? options.source : 0;

    const command = [0x02, priority, 0x00, source];
    const payload = [...Types.Notice.encode(options.notice).finish()];

    this.executeCommand(command, payload, callback);
};

/**
 * @param options {object}
 * @param options.forecastScene {ForecastScene}
 * @param options.slot {number}
 * @param options.mode {number}
 * @param callback
 */
GlanceClockDevice.prototype.saveForecastScene = function(options, callback) {
    const command = [7, 1, options.mode, options.slot];
    const payload = [...Types.ForecastScene.encode(options.forecastScene).finish()];

    console.log(command);
    console.log(JSON.stringify(payload));

    this.executeCommand(command, payload, callback);
};


GlanceClockDevice.prototype.scenesStop = function(callback) {
    this.executeCommand([30], [], callback);
};

GlanceClockDevice.prototype.scenesStart = function(callback) {
    this.executeCommand([31], [], callback);
};

GlanceClockDevice.prototype.scenesClear = function(callback) {
    this.executeCommand([32], [], callback);
};

/**
 * @param options {object}
 * @param options.slot {number}
 * @param callback
 */
GlanceClockDevice.prototype.scenesDelete = function(options, callback) {
    this.executeCommand([33, 0, 0, options.slot], [], callback);
};

/**
 * @param options {object}
 * @param options.from {number}
 * @param options.to {number}
 * @param callback
 */
GlanceClockDevice.prototype.scenesDeleteMany = function(options, callback) {
    this.executeCommand([34, 0, options.to, options.from], [], callback);
};

GlanceClockDevice.prototype.scenesUpdateAndRefresh = function(callback) {
    this.executeCommand([35], [], callback);
};


module.exports = GlanceClockDevice;
