const Device = require("../Device");
const GlanceClockMqttHandler = require("./GlanceClockMqttHandler");
const Types = require("./Types");

//This class needs to check the connection status on every action which is performed and should try to connect if it isn't
//Also, everything should fail if the class isn't initialized

class GlanceClockDevice extends Device {
    constructor(options) {
        super(options);

        this.mqttHandler = new GlanceClockMqttHandler({
            device: this,
            prefix: "glanceclock"
        });

        this.deviceInterface = null;
    }

    initialize(callback) {
        this.blueZservice.getInterface(
            this.pathRoot + "/dev_" + this.macInDbusNotation,
            "org.bluez.Device1",
            (err, deviceInterface) => {
                err = Array.isArray(err) ? err.join(".") : err;

                if (!err && deviceInterface) {
                    deviceInterface.Paired((err, isPaired) => {
                        if (!err && isPaired === true) {
                            this.deviceInterface = deviceInterface;

                            this.mqttHandler.initialize(callback);
                        } else {
                            if (err) {
                                callback(Array.isArray(err) ? err.join(".") : err);
                            } else {
                                callback(new Error("GlanceClock needs to be paired with " + this.hciDevice));
                            }
                        }
                    });
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
    }

    handleAdvertisingForDevice (props) {
        super.handleAdvertisingForDevice(props);

        if (props.Connected !== undefined) {
            this.mqttHandler.updatePresence(props.Connected);
        }

        if (props.ServicesResolved === true) {
            this.getSettings((err, settings) => {
                if (!err) {
                    this.mqttHandler.updateState(settings);
                }
            });
        }
    }

    handleMqttMessage(topic, message) {
        this.mqttHandler.handleMessage(topic, message);
    }

    //This ensures that the device is connected
    executionHelper(callback) { //TODO: queue commands and execute only one at a time
        const self = this;
        let retryCount = 0;

        async function executionHelperHelper(callback) { //This. Name.
            try {
                await self.connectDeviceAsync(self.deviceInterface);
            } catch (e) {
                console.error(e);
                return errorRetryHelper(callback);
            }

            callback();
        }

        function errorRetryHelper(callback) {
            if (retryCount < 15) {
                retryCount++;

                executionHelperHelper(callback).then();
            } else {
                console.info("ExecutionHelper: Retries exceeded for " + self.friendlyName);
                callback(new Error("Retries exceeded"));
            }
        }

        if (this.deviceInterface) {
            executionHelperHelper(callback).then();
        } else {
            callback(new Error("GlanceClockDevice has not been initialized."));
        }
    }

    /**
     *
     * @param {Array<number>} command //0-255 only
     * @param {Array<number>} payload //0-255 only
     * @param callback
     */
    executeCommand(command, payload, callback) {
        const self = this;
        let retryCount = 0;

        function executeCommandHelper(command, payload, callback) {
            self.executionHelper(err => {
                if (!err) {
                    let value = command;
                    const options = {type: "request"};

                    if (Array.isArray(payload)) {
                        value = command.concat(payload);
                    }

                    self.semaphore.take(() => {
                        self.characteristicsByUUID[GlanceClockDevice.CHARACTERISTICS.settings].WriteValue(value, options, err => {
                            self.semaphore.leave();
                            err = Array.isArray(err) ? err.join(".") : err;

                            if (err) {
                                if (retryCount < 5) {
                                    retryCount++;

                                    console.info("ExecuteCommand: Got Error " + err + " Retrying for " + self.friendlyName); //TODO: handle notConnected
                                    executeCommandHelper(command, payload, callback);
                                } else {
                                    console.info("ExecuteCommand: Retries exceeded for " + self.friendlyName);
                                    callback(err);
                                }
                            } else {
                                callback();
                            }
                        });
                    });
                } else {
                    callback(err);
                }
            });
        }

        if (Array.isArray(command) && command.length > 0) {
            executeCommandHelper(command, payload, callback);
        } else {
            callback(new Error("Missing command"));
        }
    }

    updateAndRefresh(callback) {
        this.executeCommand([35], [], callback);
    }

    getSettings(callback) {
        this.executionHelper(err => {
            if (!err) {
                this.semaphore.take(() => {
                    this.characteristicsByUUID[GlanceClockDevice.CHARACTERISTICS.settings].ReadValue({}, (err, settingsBuf) => {
                        this.semaphore.leave();

                        if (!err) {
                            let settings;

                            try {
                                settings = Types.Settings.decode(settingsBuf);
                            } catch (e) {
                                console.error(this.friendlyName, "Failed to decode Settings. Replacing with defaults. Error: ", e);
                                settings = Types.Settings.decode(GlanceClockDevice.DEFAULT_SETTINGS);
                            }

                            callback(null, settings);
                        } else {
                            callback(Array.isArray(err) ? err.join(".") : err);
                        }
                    });
                });
            } else {
                callback(err);
            }
        });
    }


    setSettings(settings, callback) {
        const command = [0x05,0x00,0x00,0x00];
        const payload = [...Types.Settings.encode(settings).finish()];

        this.executeCommand(command, payload, err => {
            if (!err) {
                this.mqttHandler.updateState(settings);
            }

            callback(err);
        });
    }

    /**
     * @param {object} options
     * @param {Notice} options.notice
     * @param {number} [options.priority]
     * @param {number} [options.source]
     * @param callback
     */
    notify(options, callback) {
        const priority = options.priority !== undefined ? options.priority : 16;
        const source = options.source !== undefined ? options.source : 0;

        const command = [0x02, priority, 0x00, source];
        const payload = [...Types.Notice.encode(options.notice).finish()];

        this.executeCommand(command, payload, callback);
    }

    /**
     * @param {object} options
     * @param {ForecastScene} options.forecastScene
     * @param {number} options.slot
     * @param {number} options.mode
     * @param callback
     */
    saveForecastScene(options, callback) {
        const command = [7, 1, options.mode, options.slot];
        const payload = [...Types.ForecastScene.encode(options.forecastScene).finish()];

        this.executeCommand(command, payload, callback);
    }


    scenesStop(callback) {
        this.executeCommand([30], [], callback);
    }

    scenesStart(callback) {
        this.executeCommand([31], [], callback);
    }

    scenesClear(callback) {
        this.executeCommand([32], [], callback);
    }

    /**
     * @param {object} options
     * @param {number} options.slot
     * @param callback
     */
    scenesDelete(options, callback) {
        this.executeCommand([33, 0, 0, options.slot], [], callback);
    }

    /**
     * @param {object} options
     * @param {number} options.from
     * @param {number} options.to
     * @param callback
     */
    scenesDeleteMany(options, callback) {
        this.executeCommand([34, 0, options.to, options.from], [], callback);
    }

    scenesUpdateAndRefresh(callback) {
        this.executeCommand([35], [], callback);
    }

    /**
     * @param {object} options
     * @param {Timer} [options.timer]
     *
     * @param callback
     */
    timerSet(options, callback) {
        const command = [0x03, 0x00, 0x00, 0x00];
        const payload = [...Types.Timer.encode(options.timer).finish()];

        this.executeCommand(command, payload, callback);
    }

    timerStop(callback) {
        this.executeCommand([10], [], callback);
    }

}

GlanceClockDevice.CHARACTERISTICS = {
    settings: "5075fb2e-1e0e-11e7-93ae-92361f002671"
};

GlanceClockDevice.DEFAULT_SETTINGS = Buffer.from([0x10, 0x01, 0x28, 0x01, 0x48, 0x01, 0x50, 0x80, 0xBA, 0xA2, 0x03, 0x58, 0x01, 0x60, 0x00]);

module.exports = GlanceClockDevice;
