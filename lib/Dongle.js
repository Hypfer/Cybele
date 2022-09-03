const child_process = require("child_process");
const events = require("events");

class Dongle extends events.EventEmitter {
    /**
     * @param {object} options
     * @param options.bus
     * @param {string} options.hciDevice
     * @param {"le"|"bredr"|"auto"} options.mode
     * @param {object} [options.troubleshooting]
     * @param {number} [options.troubleshooting.scanRestartInterval]
     * @param {object} [options.troubleshooting.brickWatchdog]
     * @param {number} [options.troubleshooting.brickWatchdog.timeout]
     * @param {string} [options.troubleshooting.brickWatchdog.recoveryCommand]
     * @param {Array<Service>} options.services
     * @param {Array<Device>} options.devices
     * @param {Semaphore} options.semaphore
     * @constructor
     */
    constructor(options) {
        super();

        this.bus = options.bus;
        this.hciDevice = options.hciDevice;
        this.mode = options.mode;
        this.services = options.services;
        this.devices = options.devices;
        this.semaphore = options.semaphore;

        if (options.troubleshooting) {
            this.scanRestartInterval = options.troubleshooting.scanRestartInterval;
            this.brickWatchdog = options.troubleshooting.brickWatchdog;
        }

        this.blueZservice = this.bus.getService("org.bluez");
        this.pathRoot = "/org/bluez/" + this.hciDevice;

        this.busListener = (msg) => {
            this.busMsgHandler(msg);
        };

        this.restartDiscoveryTimeout = null;
        this.brickWatchdogTimeout = null;
        this.destroyed = false;
    }

    async initialize() {
        this.bus.connection.on("message", this.busListener.bind(this));

        this.bus.addMatch("type='signal'");

        await this.startDiscovery();

        if (this.brickWatchdog && this.brickWatchdog.timeout) {
            this.brickWatchdogTick();
        }
    }

    async destroy() {
        this.destroyed = true;
        clearTimeout(this.restartDiscoveryTimeout);
        clearTimeout(this.brickWatchdogTimeout);
        this.bus.connection.removeListener("message", this.busListener);

        for (const device of this.devices) {
            await new Promise((resolve) => {
                device.destroy((err) => {
                    if (err) {
                        console.error(err); //TODO: handle error
                    }

                    resolve();
                });
            });
        }
        this.devices = [];

        for (const service of this.services) {
            await service.destroy();
        }
        this.services = [];
    }

    startDiscovery() {
        return new Promise((resolve, reject) => {
            this.blueZservice.getInterface(this.pathRoot, "org.bluez.Adapter1", (err, adapterInterface) => {
                if (!err && adapterInterface) {
                    adapterInterface.StopDiscovery(err => {
                        err = Array.isArray(err) ? err.join(".") : err;

                        if (!err || err === "No discovery started") {
                            //https://git.kernel.org/pub/scm/bluetooth/bluez.git/tree/src/adapter.c#n1541
                            //To get faster scanning without delays, we need to set at least one filter.
                            //TODO: we _may_ need to clear all other filters?
                            adapterInterface.SetDiscoveryFilter([["Transport", ["s", this.mode]], ["DuplicateData", ["b", true]]], err => {
                                err = Array.isArray(err) ? err.join(".") : err;

                                if (!err) {
                                    adapterInterface.StartDiscovery(err => {
                                        err = Array.isArray(err) ? err.join(".") : err;

                                        if (!err) {
                                            if (this.scanRestartInterval > 0 && this.destroyed === false) {
                                                this.restartDiscoveryTimeout = setTimeout(() => {
                                                    if (this.destroyed === false) {
                                                        this.startDiscovery(err => {
                                                            err = Array.isArray(err) ? err.join(".") : err;

                                                            if (err) {
                                                                console.error(err);
                                                            }
                                                        });
                                                    }
                                                }, this.scanRestartInterval);
                                            }

                                            resolve();
                                        } else {
                                            if (err === "Operation already in progress") {
                                                this.emit("death", err);
                                                resolve();
                                            } else {
                                                reject(err);
                                            }
                                        }
                                    });
                                } else {
                                    reject(err);
                                }
                            });
                        } else {
                            this.executeBrickWatchdog(() => {
                                reject(err);
                            });
                        }
                    });
                } else {
                    reject({
                        message: "Failed to fetch adapter Interface for " + this.hciDevice,
                        error: err
                    });
                }
            });
        });
    }

    busMsgHandler(msg) {
        if (msg?.path?.indexOf(this.pathRoot) === 0) {
            if (Array.isArray(msg.body)) {
                if (msg.body[0] === "org.bluez.Device1") {
                    let dev = msg.path.split("/");
                    dev = dev[dev.length - 1];

                    const props = {};
                    if (Array.isArray(msg.body[1])) { //TODO: Write a working parser for this mess of arrays
                        msg.body[1].forEach(prop => {
                            if (Array.isArray(prop) && prop.length === 2 && Array.isArray(prop[1])) {
                                const key = prop[0];
                                let val = prop[1][1];

                                if (Array.isArray(val)) {
                                    if (key === "ManufacturerData") {
                                        try {
                                            val = val[0][0][1][1][0];
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    } else if (key === "ServiceData") {
                                        try {
                                            val = {
                                                UUID: val[0][0][0],
                                                data: val[0][0][1][1][0]
                                            };
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    } else if (val.length === 1) {
                                        val = val[0];
                                    }

                                }

                                props[key] = val;
                            }
                        });
                    } else {
                        console.log("Unhandled Device msg:", msg, JSON.stringify(msg));
                    }

                    if (this.brickWatchdogTimeout) {
                        this.brickWatchdogTick();
                    }

                    this.devices.forEach(d => {
                        d.handleDbusMessage("org.bluez.Device1", dev, props);
                    });
                } else if (msg.body[0] === "org.bluez.GattCharacteristic1") {
                    const splitPath = msg.path.split("/");
                    const dev = splitPath[4];
                    const characteristic = [splitPath[5], splitPath[6]].join("/");

                    if (Array.isArray(msg.body[1]) && Array.isArray(msg.body[1][0]) && msg.body[1][0][0] === "Value") {
                        const props = {};
                        const value = msg.body[1][0][1][1][0]; //TODO: Will this break on non-buffer values?

                        props[characteristic] = value;

                        this.devices.forEach(d => {
                            d.handleDbusMessage("org.bluez.GattCharacteristic1", dev, props);
                        });
                    }
                } else {
                    if (msg && Array.isArray(msg.body) && msg.body[0] === "org.bluez.Adapter1") {
                        if (JSON.stringify(msg).includes("[\"Powered\",[[{\"type\":\"b\",\"child\":[]}],[false]]]")) {
                            //TODO: improve condition

                            this.emit("death", msg);
                        } else {
                            //unhandled adapter message
                        }
                    } else {
                        console.log("Unhandled other msg:", msg, JSON.stringify(msg));
                    }
                }
            } else {
                console.log(msg);
            }
        } else {
            //general dbus messages
        }
    }

    brickWatchdogTick() {
        clearTimeout(this.brickWatchdogTimeout);

        this.brickWatchdogTimeout = setTimeout(() => {
            console.error("Brick Watchdog executed for " + this.hciDevice);

            this.executeBrickWatchdog(() => {});

        }, this.brickWatchdog.timeout);
    }

    executeBrickWatchdog(callback) {
        if (this.brickWatchdog.recoveryCommand) {
            child_process.exec(this.brickWatchdog.recoveryCommand, (err, stdout, stderr) => {
                console.info(err, stdout, stderr);

                callback();
            });
        } else {
            callback();
        }
    }
}


module.exports = Dongle;
