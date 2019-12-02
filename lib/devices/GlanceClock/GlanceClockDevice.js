const util = require("util");

const Device = require("../Device");
const Types = require("./Types");
const GlanceClockMqttHandler = require("./GlanceClockMqttHandler");

/**
 *
 * @param options
 * @constructor
 */
const GlanceClockDevice = function GlanceClockDevice(options) {
    Device.call(this, options);

    this.mqttHandler = new GlanceClockMqttHandler({
        device: this,
        prefix: "glanceclock"
    });

    this.deviceInterface = null;
};

util.inherits(GlanceClockDevice, Device);

//This class needs to check the connection status on every action which is performed and should try to connect if it isn't
//Also, everything should fail if the class isn't initialized

GlanceClockDevice.prototype.initialize = function(callback) {
    this.blueZservice.getInterface(
        this.pathRoot + "/dev_" + this.macInDbusNotation,
        "org.bluez.Device1",
        (err, deviceInterface) => {
            err = Array.isArray(err) ? err.join(".") : err;

            if(!err && deviceInterface) {
                deviceInterface.Paired((err, isPaired) => {
                    if(!err && isPaired === true) {
                        this.deviceInterface = deviceInterface;

                        this.mqttHandler.initialize(callback);
                    } else {
                        if(err) {
                            callback(Array.isArray(err) ? err.join(".") : err);
                        } else {
                            callback(new Error("GlanceClock needs to be paired with " + this.hciDevice))
                        }
                    }
                })
            } else {
                callback({
                    message: "Failed to fetch device interface from D-Bus. Is the Clock paired with this hci device?",
                    name: this.friendlyName,
                    mac: this.mac,
                    hciDevice: this.hciDevice
                });
            }
        }
    );
};

GlanceClockDevice.prototype.handleAdvertisingForDevice = function (props) {
    Device.prototype.handleAdvertisingForDevice.call(this, props);

    if (props.Connected !== undefined) {
        this.mqttHandler.updatePresence(props.Connected);
    }

    if (props.ServicesResolved === true) {
        this.getSettings((err, settings) => {
            if(!err) {
                this.mqttHandler.updateState(settings);
            }
        })
    }
};

GlanceClockDevice.prototype.handleMqttMessage = function(topic, message) {
    this.mqttHandler.handleMessage(topic, message);
};

//This ensures that the device is connected
GlanceClockDevice.prototype.executionHelper = function(callback) {
    const self = this;
    let retryCount = 0;

    async function executionHelperHelper(callback) { //This. Name.
        try {
            await self.connectDeviceAsync(self.deviceInterface);
        } catch(e) {
            console.error(e);
            return errorRetryHelper(callback);
        }

        callback();
    }

    function errorRetryHelper(callback) {
        if(retryCount < 15) {
            retryCount++;

            executionHelperHelper(callback).then();
        } else {
            console.info("ExecutionHelper: Retries exceeded for " + self.friendlyName);
            callback(new Error("Retries exceeded"));
        }
    }

    if(this.deviceInterface) {
        executionHelperHelper(callback).then();
    } else {
        callback(new Error("GlanceClockDevice has not been initialized."));
    }
};

/**
 *
 * @param command {Array<number>} //0-255 only
 * @param payload {Array<number>} //0-255 only
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
                    self.characteristicsByUUID[GlanceClockDevice.CHARACTERISTICS.settings].WriteValue(value, options, err => {
                        self.semaphore.leave();
                        err = Array.isArray(err) ? err.join(".") : err;

                        if(err) {
                            if(retryCount < 5) {
                                retryCount++;

                                console.info("ExecuteCommand: Got Error " + err + " Retrying for " + self.friendlyName); //TODO: handle notConnected
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
                this.characteristicsByUUID[GlanceClockDevice.CHARACTERISTICS.settings].ReadValue({}, (err, settingsBuf) => {
                    this.semaphore.leave();

                    if(!err) {
                        let settings;

                        try {
                            settings = Types.Settings.decode(settingsBuf);
                        } catch(e) {
                            console.error(this.friendlyName, "Failed to decode Settings. Replacing with defaults. Error: ", e);
                            settings = Types.Settings.decode(GlanceClockDevice.DEFAULT_SETTINGS)
                        }

                        callback(null, settings)
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

    this.executeCommand(command, payload, err => {
        if(!err) {
            this.mqttHandler.updateState(settings);
        }

        callback(err);
    });
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

GlanceClockDevice.CHARACTERISTICS = {
    settings: "5075fb2e-1e0e-11e7-93ae-92361f002671"
};

GlanceClockDevice.DEFAULT_SETTINGS = Buffer.from([0x10, 0x01, 0x28, 0x01, 0x48, 0x01, 0x50, 0x80, 0xBA, 0xA2, 0x03, 0x58, 0x01, 0x60, 0x00]);

module.exports = GlanceClockDevice;
