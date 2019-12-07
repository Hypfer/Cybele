const util = require("util");
const Device = require("../Device");

const EqivaThermostatMqttHandler = require("./EqivaThermostatMqttHandler");

/**
 *
 * @param options
 * @param options.pollingInterval {number}
 * @constructor
 */
const EqivaThermostatDevice = function EqivaThermostatDevice(options) {
    Device.call(this, options);

    this.mqttHandler = new EqivaThermostatMqttHandler({
        device: this,
        prefix: EqivaThermostatDevice.MQTT_PREFIX
    });


    this.pollingInterval = options.pollingInterval;

    this.pollTimeout = null;
    this.destroyed = false;
};

util.inherits(EqivaThermostatDevice, Device);

EqivaThermostatDevice.prototype.initialize = function (callback) {
    this.mqttHandler.initialize(err => {
        if(!err) {
            this.queuePolling();
        }
        callback(err);
    });
};

EqivaThermostatDevice.prototype.destroy = function (callback) {
    this.destroyed = true;
    clearTimeout(this.pollTimeout);

    callback();
};

EqivaThermostatDevice.prototype.queuePolling = function () {
    clearTimeout(this.pollTimeout);

    this.pollTimeout = setTimeout(() => {
        if (this.destroyed === false) {
            this.poll()
        }
    }, this.pollingInterval);
};

EqivaThermostatDevice.prototype.poll = function () {
    this.sendStatusCommand(err => {
        if (err) {
            console.error(err);
        }

        this.queuePolling();
    })
};


EqivaThermostatDevice.prototype.handleNotificationForDevice = function (props) {
    Device.prototype.handleNotificationForDevice.call(this, props);

    if (props[this.handlesByUUID[EqivaThermostatDevice.CHARACTERISTICS.response]]) {
        this.handleStatusUpdate(props[this.handlesByUUID[EqivaThermostatDevice.CHARACTERISTICS.response]]);
    }
};

EqivaThermostatDevice.prototype.handleStatusUpdate = function (buf) {
    const status = EqivaThermostatDevice.PARSE_STATUS(buf);

    this.mqttHandler.updateState(status);
    this.queuePolling(); //Since we already have a status, postpone everything that might be pending atm

    //Also, we don't have to disconnect because the device will do that automatically after 2 minutes of inactivity
};

EqivaThermostatDevice.prototype.connectAndSubscribeAsync = function () {
    const self = this;

    return new Promise(async function (resolve, reject) {
        let deviceInterface;

        try {
            deviceInterface = await self.getDBusInterfaceAsync(
                self.pathRoot + "/dev_" + self.macInDbusNotation,
                "org.bluez.Device1"
            )
        } catch (e) {
            return reject({
                message: "Failed to get device interface. Maybe the thermostat is out of range?",
                error: e
            });
        }

        try {
            await self.connectDeviceAsync(deviceInterface, 5000, 10); //todo: configurable?
        } catch (e) {
            return reject({
                message: "Failed to connect to thermostat",
                error: e
            });
        }

        self.characteristicsByUUID[EqivaThermostatDevice.CHARACTERISTICS.response].Notifying(async (err, notifying) => {
            err = Array.isArray(err) ? err.join(".") : err;

            if (!err && notifying === true) {
                return resolve();
            } else {
                await self.takeSemaphoreAsync();

                self.characteristicsByUUID[EqivaThermostatDevice.CHARACTERISTICS.response].StartNotify(err => {
                    self.semaphore.leave();
                    err = Array.isArray(err) ? err.join(".") : err;

                    if (!err) {
                        resolve();
                    } else {
                        reject({
                            message: "Failed to start notifying",
                            error: err
                        })
                    }
                })
            }
        })
    });
};

EqivaThermostatDevice.prototype.disconnectAndUnsubscribeAsync = function () {
    const self = this;

    return new Promise(async function (resolve, reject) {
        let deviceInterface;

        try {
            deviceInterface = await self.getDBusInterfaceAsync(
                self.pathRoot + "/dev_" + self.macInDbusNotation,
                "org.bluez.Device1"
            )
        } catch (e) {
            return reject({
                message: "Failed to get device interface. Maybe the thermostat is out of range?",
                error: e
            });
        }

        self.characteristicsByUUID[EqivaThermostatDevice.CHARACTERISTICS.response].Notifying(async (err, notifying) => {
            err = Array.isArray(err) ? err.join(".") : err;

            if (!err) {
                if (notifying === false) {
                    deviceInterface.Disconnect(err => {
                        if (!err) {
                            resolve();
                        } else {
                            reject({
                                message: "Failed to disconnect",
                                error: err
                            })
                        }
                    })
                } else {
                    await self.takeSemaphoreAsync();
                    self.characteristicsByUUID[EqivaThermostatDevice.CHARACTERISTICS.response].StopNotify([], err => {
                        self.semaphore.leave();
                        err = Array.isArray(err) ? err.join(".") : err;

                        if (!err || err === "No notify session started") {
                            deviceInterface.Disconnect(err => {
                                if (!err) {
                                    resolve();
                                } else {
                                    reject({
                                        message: "Failed to disconnect",
                                        error: err
                                    })
                                }
                            });
                        } else {
                            reject({
                                message: "Failed to stop notifying",
                                error: err
                            })
                        }
                    });
                }
            } else {
                reject({
                    message: "Failed to check notifying",
                    error: err
                })
            }
        })
    });
};

EqivaThermostatDevice.prototype.sendCommand = async function (command, callback) {
    try {
        await this.connectAndSubscribeAsync();

        await this.writeCharacteristicAsync(
            this.characteristicsByUUID[EqivaThermostatDevice.CHARACTERISTICS.request],
            command,
            "request"
        );

        callback();
    } catch (e) {
        return callback(e);
    }
};

//TODO: window mode

EqivaThermostatDevice.prototype.sendOffsetCommand = function(offset, callback) {
    if(typeof offset === "number" && offset >= -3.5 && offset <= 3.5) {
        const cmd = Buffer.alloc(2);

        cmd.writeUInt8(0x13, 0);
        cmd.writeUInt8(Math.floor((offset + 3.5)*2));

        this.sendCommand(cmd, callback).then();
    } else {
        callback(new Error("Invalid offset"));
    }
};

EqivaThermostatDevice.prototype.sendModeCommand = function (mode, callback) {
    const cmd = Buffer.alloc(2);

    cmd.writeUInt8(0x40, 0);

    switch (mode) {
        case "auto":
            cmd.writeUInt8(0, 1);
            break;
        case "manual":
            cmd.writeUInt8(40, 1);
            break;
        default:
            return callback(new Error("Invalid mode"));
    }

    this.sendCommand(cmd, callback).then();
};

EqivaThermostatDevice.prototype.sendBoostModeCommand = function (boost, callback) {
    if (typeof boost === "boolean") {
        const cmd = Buffer.alloc(2);

        cmd.writeUInt8(0x45, 0);
        cmd.writeUInt8(boost ? 1 : 0, 1);

        this.sendCommand(cmd, callback).then();
    } else {
        callback(new Error("Invalid boost value"))
    }
};

EqivaThermostatDevice.prototype.sendTargetTemperatureCommand = function (temp, callback) {
    if (typeof temp === "number" && temp >= 4.5 && temp <= 30) {
        const cmd = Buffer.alloc(2);
        const targetTemp = Math.floor(temp * 2);

        cmd.writeUInt8(0x41, 0);
        cmd.writeUInt8(targetTemp, 1);

        this.sendCommand(cmd, callback).then();
    } else {
        callback(new Error("Invalid temp value"))
    }
};

EqivaThermostatDevice.prototype.sendStatusCommand = function (callback) {
    const now = new Date();
    const cmd = Buffer.alloc(7);

    cmd.writeUInt8(0x03, 0); //Status+Sync command

    cmd.writeUInt8(now.getFullYear() % 100, 1);
    cmd.writeUInt8(now.getMonth() + 1, 2);
    cmd.writeUInt8(now.getDate(), 3);
    cmd.writeUInt8(now.getHours(), 4);
    cmd.writeUInt8(now.getMinutes(), 5);
    cmd.writeUInt8(now.getSeconds(), 6);


    this.sendCommand(cmd, callback).then();
};

EqivaThermostatDevice.PARSE_STATUS = function (data) {
    const result = {};
    const flags = Array.from(data.readUInt8(2).toString(2).padStart(8)).reverse();

    if (flags[0] === "1") {
        result.mode = "manual";
    } else {
        result.mode = "auto";
    }

    result.vacation = flags[1] === "1";
    result.boost = flags[2] === "1";
    result.dst = flags[3] === "1";
    result.window_open = flags[4] === "1";
    result.locked = flags[5] === "1";
    result.low_bat = flags[7] === "1";

    result.valve = data.readInt8(3);
    result.temperature = data.readInt8(5) / 2;

    return result;
};

EqivaThermostatDevice.CHARACTERISTICS = {
    request: "3fa4585a-ce4a-3bad-db4b-b8df8179ea09",
    response: "d0e8434d-cd29-0996-af41-6c90f4e0eb2a"
};

EqivaThermostatDevice.MQTT_PREFIX = "eqiva_thermostat";

module.exports = EqivaThermostatDevice;