const util = require("util");
const crypto = require("crypto");
const async = require("async");
const Semaphore = require("semaphore");

const Device = require("../Device");
const MiCipher = require("./MiCipher");
const MiKettleMqttHandler = require("./MiKettleMqttHandler");

/**
 *
 * @param options {object}
 * @param options.productId {number}
 * @constructor
 */
const MiKettleDevice = function MiKettleDevice(options) { //TODO: use async/await
    Device.call(this, options);

    this.mqttHandler = new MiKettleMqttHandler({
        device: this,
        prefix: "kettle"
    });

    this.reversedMac = this.mac.split(":").map(s => parseInt(s, 16)).reverse();
    this.productId = options.productId;

    this.connectionSemaphore = new Semaphore(1);
    this.token = Buffer.alloc(12);
    crypto.randomFillSync(this.token);

    this.extendedAttributes = {};
};

util.inherits(MiKettleDevice, Device);

MiKettleDevice.prototype.initialize = function (callback) {
    this.prepareDeviceInterface((err, deviceInterface) => {
        if(!err && deviceInterface) {
            deviceInterface.Connected((err, isConnected) => { //This can actually lie for some reason.
                if (!err && isConnected === true) {
                    console.info(this.friendlyName + " is already connected.");
                    this.connected = true;

                    this.mapServicesAsync().then(() => {
                        this.enableStatusNotifications(err => {
                            if (err) {
                                console.error(err);
                            } else {
                                this.fetchExtendedAttributes(err => {
                                    if (err) {
                                        console.error(err);
                                    }
                                })
                            }
                        })
                    }).catch(err => {
                        console.error(err);
                    })
                }
            })
        }
    });

    this.mqttHandler.initialize(err => {
        callback(err);
    })
};

MiKettleDevice.prototype.handleAdvertisingForDevice = function (props) {
    Device.prototype.handleAdvertisingForDevice.call(this, props);

    if(props.Connected !== undefined) {
        this.mqttHandler.updatePresence(props.Connected);

        if(props.Connected === false) {
            console.info("Disconnected from " + this.friendlyName);
        }
    }

    if(Object.keys(props).length === 1 && props.RSSI !== undefined) {
        if(props.RSSI < -98) {
            console.info("Signal is very weak. Connection to" + this.friendlyName + " might fail or be unreliable.");
        }
        if (this.connected === false && this.connectionSemaphore.available()) {
            this.connectionSemaphore.take(() => {
                this.connectToKettle(err => {
                    if (err) {
                        console.error(this.friendlyName, err, "while connecting");
                    }
                })
            });
        }
    }
};

MiKettleDevice.prototype.handleNotificationForDevice = function (props) {
    if (props[this.handlesByUUID[MiKettleDevice.CHARACTERISTICS.auth]]) {
        this.doAuthStageThree(props[this.handlesByUUID[MiKettleDevice.CHARACTERISTICS.auth]], err => {
            if (err) {
                console.error(err);
            } else {
                this.enableStatusNotifications(err => {
                    if (err) {
                        console.error(err);
                    } else {
                        console.info("Connected to " + this.friendlyName);

                        this.fetchExtendedAttributes(err => {
                            if(err) {
                                console.error(err);
                            }
                        })
                    }
                })
            }
        });
    } else if (props[this.handlesByUUID[MiKettleDevice.CHARACTERISTICS.status]]) {
        const parsedStatus = MiKettleDevice.PARSE_STATUS(props[this.handlesByUUID[MiKettleDevice.CHARACTERISTICS.status]]);
        parsedStatus.boil_mode = this.extendedAttributes.boilMode;
        parsedStatus.keep_warm_time_limit = this.extendedAttributes.keepWarmTimeLimit;

        this.mqttHandler.updateState(parsedStatus);
    }
};

MiKettleDevice.prototype.connectToKettle = function (callback) {
    this.prepareDeviceInterface(async (err, deviceInterface) => {
        if(!err && deviceInterface) {
            try {
                await this.connectDeviceAsync(deviceInterface, 4000); //TODO: does this make sense?
            } catch(e) {
                this.connectionSemaphore.leave(); //This is so confusing it will definitely break at some point
                return callback(e);
            }

            this.doAuthStageOne(err => {
                this.connectionSemaphore.leave();
                callback(err);
            })
        } else {
            callback(new Error("Missing device Interface"))
        }
    })
};

MiKettleDevice.prototype.doAuthStageOne = function (callback) {
    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.authInit].WriteValue(MiKettleDevice.KEY1, {type: "command"}, err => {
            this.semaphore.leave();
            if (!err) {
                this.doAuthStageTwo(callback);
            } else {
                callback(Array.isArray(err) ? err.join(".") : err);
            }
        });
    });
};

MiKettleDevice.prototype.doAuthStageTwo = function (callback) {
    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.auth].StartNotify([], err => {
            this.semaphore.leave();

            if (!err) {
                const value = MiCipher.cipher(MiCipher.mixA(this.reversedMac, this.productId), this.token);

                this.semaphore.take(() => {
                    this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.auth].WriteValue(value, {type: "request"}, err => {
                        this.semaphore.leave();

                        callback(Array.isArray(err) ? err.join(".") : err);
                    })
                })
            } else {
                callback(Array.isArray(err) ? err.join(".") : err)
            }
        });
    });
};

MiKettleDevice.prototype.doAuthStageThree = function (data, callback) {
    const response = MiCipher.cipher(
        MiCipher.mixB(this.reversedMac, this.productId),
        MiCipher.cipher(
            MiCipher.mixA(this.reversedMac, this.productId),
            data
        )
    );

    if (response.compare(this.token) === 0) {
        this.semaphore.take(() => {
            const value = MiCipher.cipher(this.token, MiKettleDevice.KEY2);

            this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.auth].WriteValue(value, {type: "command"}, err => {
                this.semaphore.leave();

                if (!err) {
                    this.doAuthStageFour(callback);
                } else {
                    callback(Array.isArray(err) ? err.join(".") : err);
                }
            })
        })
    } else {
        callback(new Error("Verification failed"))
    }
};

MiKettleDevice.prototype.doAuthStageFour = function (callback) {
    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.verify].ReadValue({}, err => {
            this.semaphore.leave();
            callback(Array.isArray(err) ? err.join(".") : err);
        });
    });
};

MiKettleDevice.prototype.prepareDeviceInterface = function(callback) {
    this.blueZservice.getInterface(
        this.pathRoot + "/dev_" + this.macInDbusNotation,
        "org.bluez.Device1",
        (err, deviceInterface) => {
            callback(err, deviceInterface);
        }
    );
};

MiKettleDevice.prototype.enableStatusNotifications = function (callback) {
    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.status].StopNotify([], err => {
            this.semaphore.leave();
            err = Array.isArray(err) ? err.join(".") : err;

            if(!err || err === "No notify session started") {
                setTimeout(() => {
                    this.semaphore.take(() => {
                        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.status].StartNotify([], err => {
                            this.semaphore.leave();

                            callback(Array.isArray(err) ? err.join(".") : err)
                        });
                    });
                }, 1000) //TODO: Why is this needed?
            } else {
                callback(err)
            }
        })
    });
};

MiKettleDevice.prototype.fetchExtendedAttributes = function(callback) {
    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.boilMode].ReadValue({}, (err, boilMode) => {
            this.semaphore.leave();
            err = Array.isArray(err) ? err.join(".") : err;


            if(!err && boilMode) {
                this.extendedAttributes.boilMode = MiKettleDevice.BOIL_MODE[boilMode[0]];

                this.semaphore.take(() => {
                    this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.time].ReadValue({}, (err, time) => {
                        this.semaphore.leave();
                        err = Array.isArray(err) ? err.join(".") : err;

                        if(!err && time) {
                            this.extendedAttributes.keepWarmTimeLimit = time[0] / 2;
                        }

                        callback(err);
                    })
                });
            } else {
                callback(err);
            }
        })
    })
};

MiKettleDevice.prototype.setKeepWarmParameters = function(mode, temp, callback) {
    const payload = Buffer.from([mode, temp]);

    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.setup].WriteValue(payload, {mode: "request"}, err => {
            this.semaphore.leave();
            err = Array.isArray(err) ? err.join(".") : err;

            callback(err);
        })
    });
};

MiKettleDevice.prototype.setKeepWarmTimeLimit = function(time, callback) {
    const payload = Buffer.from([time]);

    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.time].WriteValue(payload, {mode: "request"}, err => {
            this.semaphore.leave();
            err = Array.isArray(err) ? err.join(".") : err;

            if(!err) {
                this.extendedAttributes.keepWarmTimeLimit = time / 2;
            }

            callback(err);
        })
    });
};

MiKettleDevice.prototype.setBoilMode = function(boilMode, callback) {
    const payload = Buffer.from([boilMode]);

    this.semaphore.take(() => {
        this.characteristicsByUUID[MiKettleDevice.CHARACTERISTICS.boilMode].WriteValue(payload, {mode: "request"}, err => {
            this.semaphore.leave();
            err = Array.isArray(err) ? err.join(".") : err;

            if(!err) {
                this.extendedAttributes.boilMode = MiKettleDevice.BOIL_MODE[boilMode];
            }

            callback(err);
        })
    });
};

MiKettleDevice.CHARACTERISTICS = {
    authInit: "00000010-0000-1000-8000-00805f9b34fb",
    auth: "00000001-0000-1000-8000-00805f9b34fb",
    verify: "00000004-0000-1000-8000-00805f9b34fb",

    setup: "0000aa01-0000-1000-8000-00805f9b34fb",
    status: "0000aa02-0000-1000-8000-00805f9b34fb",
    time: "0000aa04-0000-1000-8000-00805f9b34fb",
    boilMode: "0000aa05-0000-1000-8000-00805f9b34fb"
};

MiKettleDevice.KEY1 = Buffer.from([0x90, 0xCA, 0x85, 0xDE]);
MiKettleDevice.KEY2 = Buffer.from([0x92, 0xAB, 0x54, 0xFA]);

MiKettleDevice.ACTION = {
    0: "idle",
    1: "heating",
    2: "cooling",
    3: "keeping_warm"
};
MiKettleDevice.MODE = {
    255: "none",
    1: "boil",
    2: "keep_warm"
};
MiKettleDevice.KEEP_WARM_TYPE = {
    0: "boil_and_cool_down",
    1: "heat_to_temperature"
};
MiKettleDevice.BOIL_MODE = {
    0: "keep_warm",
    1: "turn_off"
};

MiKettleDevice.PARSE_STATUS = function (data) {
    return {
        action: MiKettleDevice.ACTION[data.readUInt8(0)],
        mode: MiKettleDevice.MODE[data.readUInt8(1)],
        keep_warm_set_temperature: data.readUInt8(4),
        current_temperature: data.readUInt8(5),
        keep_warm_type: MiKettleDevice.KEEP_WARM_TYPE[data.readUInt8(6)],
        keep_warm_time: data.readUInt16LE(7)
    };
};

module.exports = MiKettleDevice;