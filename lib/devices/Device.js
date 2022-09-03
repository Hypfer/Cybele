const xml2js = require("xml2js");

class Device {
    /**
     *
     * @param {object} options
     * @param {string} options.friendlyName
     * @param {string} options.mac
     * @param {string} options.bus
     * @param {string} options.hciDevice
     * @param {Semaphore} options.semaphore
     * @param options.mqttClient
     * @constructor
     */
    constructor(options) {
        this.friendlyName = options.friendlyName;
        this.mac = options.mac;
        this.macInDbusNotation = this.mac.split(":").map(e => {
            return e.toUpperCase();
        }).join("_");

        this.bus = options.bus;
        this.hciDevice = options.hciDevice;
        this.semaphore = options.semaphore;
        this.mqttClient = options.mqttClient;
        this.blueZservice = this.bus.getService("org.bluez");
        this.pathRoot = "/org/bluez/" + this.hciDevice;

        this.id = this.mac.toLowerCase().split(":").join("");

        this.connected = false;
        this.servicesResolved = false;
        this.characteristicsByUUID = {};
        this.handlesByUUID = {};
    }

    handleDbusMessage(type, dev, props) {
        //This might be overwritten by devices
        if (dev === "dev_" + this.macInDbusNotation) {
            switch (type) {
                case "org.bluez.Device1":
                    this.handleAdvertisingForDevice(props);
                    break;
                case "org.bluez.GattCharacteristic1":
                    this.handleNotificationForDevice(props);
                    break;
            }
        }
    }

    /**
     *
     * @param {object} props
     * @param {number} [props.RSSI]
     * @param {string} [props.Name]
     * @param {string} [props.Alias]
     * @param {bool} [props.Connected]
     * @param {bool} [props.ServicesResolved]
     * @param {Buffer} [props.ManufacturerData]
     * @param {object} [props.ServiceData]
     * @param {string} props.ServiceData.UUID
     * @param {Buffer} props.ServiceData.data
     */
    handleAdvertisingForDevice(props) {
        if (props.Connected !== undefined) {
            this.connected = props.Connected;
        }

        if (props.ServicesResolved !== undefined) {
            this.servicesResolved = props.ServicesResolved;
        }


        //This will be overwritten by devices. Dont forget to call this in the device implementation
    }

    handleNotificationForDevice(props) {
        //This will be overwritten by devices
    }

    handleMqttMessage(topic, message) {
        if (this.mqttHandler) {
            this.mqttHandler.handleMessage(topic, message);
        }
    }

    initialize(callback) {
        callback();
        //Here, mqtt autodiscovery setup happens
    }

    takeSemaphoreAsync() {
        return new Promise((resolve, reject) => {
            this.semaphore.take(() => {
                resolve();
            });
        });
    }

    getDBusInterfaceAsync(path, ifaceName) {
        return new Promise((resolve, reject) => {
            this.blueZservice.getInterface(path, ifaceName, function(err, iface) {
                err = Array.isArray(err) ? err.join(".") : err;

                if (!err && iface) {
                    resolve(iface);
                } else {
                    reject({
                        message: "Failed to get Interface " + ifaceName + " for " + path,
                        error: err
                    });
                }
            });
        });
    }

    connectDeviceAsync(deviceInterface, timeout, retries) {
        const self = this;
        let retryCount = 0;

        retries = typeof retries === "number" ? retries : 0;

        function connectHelper(callback) {
            self.semaphore.take(() => {
                deviceInterface.Connect(async function(err) {
                    self.semaphore.leave();
                    err = Array.isArray(err) ? err.join(".") : err;

                    if (!err) { //Handle devices which are already connected on startup
                        deviceInterface.ServicesResolved(async (err, resolved) => {
                            if (!err) {
                                if (resolved === false) {
                                    try {
                                        await self.waitForServicesResolved(timeout);
                                    } catch (e) {
                                        return errorHelper(e, callback);
                                    }
                                } else {
                                    self.servicesResolved = true;
                                }

                                try {
                                    await self.mapServicesAsync();
                                    callback();
                                } catch (e) {
                                    return errorHelper(e, callback);
                                }
                            } else {
                                errorHelper(err, callback);
                            }
                        });


                    } else {
                        self.connected = false; //Not sure if this is needed.

                        errorHelper(err, callback);
                    }
                });
            });
        }

        function errorHelper(err, callback) {
            if (retryCount < retries) {
                console.info("Connection to " + self.friendlyName + " failed. Retrying. Error: " + err);
                retryCount++;
                connectHelper(callback);
            } else {
                callback(err);
            }
        }

        return new Promise(function(resolve, reject) {
            if (deviceInterface) {
                connectHelper(err => {
                    if (!err) {
                        resolve();
                    } else {
                        reject({
                            message: "Failed to connect to " + self.friendlyName,
                            error: err
                        });
                    }
                });
            } else {
                reject({
                    message: "Missing deviceInterface"
                });
            }
        });
    }

    async readCharacteristicAsync(characteristicInterface) {
        if (characteristicInterface) {
            await this.takeSemaphoreAsync();

            await new Promise((resolve, reject) => {
                characteristicInterface.ReadValue({}, (err, data) => {
                    this.semaphore.leave();
                    err = Array.isArray(err) ? err.join(".") : err;

                    if (!err) {
                        resolve(data);
                    } else {
                        reject(err);
                    }
                });
            });
        } else {
            throw new Error("Missing characteristicInterface");
        }
    }

    async writeCharacteristicAsync(characteristicInterface, payload, mode) {
        if (characteristicInterface) {
            await this.takeSemaphoreAsync();

            await new Promise((resolve, reject) => {
                characteristicInterface.WriteValue(payload, {type: mode}, err => {
                    this.semaphore.leave();
                    err = Array.isArray(err) ? err.join(".") : err;

                    if (!err) {
                        resolve();
                    } else {
                        reject(err);
                    }
                });
            });
        } else {
            throw new Error("Missing characteristicInterface");
        }
    }

    destroy(callback) {
        callback();
    }

    async waitForServicesResolved(timeout) {
        const start_time = new Date().getTime();

        timeout = typeof timeout === "number" && timeout > 0 ? timeout : 10000;

        while (true) {
            if (this.servicesResolved === true || new Date().getTime() > start_time + timeout) {
                break;
            }

            await new Promise(resolve => {
                return setTimeout(resolve, 10);
            });
        }

        if (this.servicesResolved === true) {
            return true;
        } else {
            throw new Error("Timeout exceeded");
        }
    }

    async introspectPathAsync(path) {
        const self = this;

        const iface = await this.getDBusInterfaceAsync(path, "org.freedesktop.DBus.Introspectable");

        return new Promise((resolve, reject) => {
            iface.Introspect((err, result) => {
                if (!err && typeof result === "string" && result.length > 0 && result[0] === "<") {
                    xml2js.parseString(result, (err, parsedResult) => {
                        if (!err && parsedResult) {
                            resolve(parsedResult);
                        } else {
                            reject({
                                message: "Failed to parse result",
                                error: err
                            });
                        }
                    });
                } else {
                    reject({
                        message: "Failed to introspect",
                        error: err,
                        result: result
                    });
                }
            });
        });
    }

    async mapServicesAsync() {
        let services = await this.introspectPathAsync(this.pathRoot + "/dev_" + this.macInDbusNotation);

        // noinspection DuplicatedCode
        if (services && services.node && Array.isArray(services.node.node)) {
            services = services.node.node.map(e => {
                if (e["$"] && e["$"].name) {
                    return e["$"].name;
                } else {
                    return false;
                }
            }).filter(e => {
                return e !== false;
            });
        } else {
            services = [];
        }

        for (const service of services) {
            await this.mapCharacteristicsAsync(service);
        }
    }

    async mapCharacteristicsAsync(service) {
        let characteristics = await this.introspectPathAsync(
            this.pathRoot + "/dev_" + this.macInDbusNotation + "/" + service
        );

        // noinspection DuplicatedCode
        if (characteristics && characteristics.node && Array.isArray(characteristics.node.node)) {
            characteristics = characteristics.node.node.map(e => {
                if (e["$"] && e["$"].name) {
                    return e["$"].name;
                } else {
                    return false;
                }
            }).filter(e => {
                return e !== false;
            });
        } else {
            characteristics = [];
        }

        for (const characteristic of characteristics) {
            const characteristicIface = await this.getDBusInterfaceAsync(
                this.pathRoot + "/dev_" + this.macInDbusNotation + "/" + service + "/" + characteristic,
                "org.bluez.GattCharacteristic1"
            );

            await new Promise((resolve, reject) => {
                characteristicIface.UUID((err, uuid) => {
                    if (!err && uuid) {
                        this.characteristicsByUUID[uuid] = characteristicIface;
                        this.handlesByUUID[uuid] = service + "/" + characteristic;

                        resolve();
                    } else {
                        console.error({
                            message: "Failed to fetch uuid for characteristic" + characteristic,
                            error: err
                        });

                        reject(err);
                    }
                });
            });
        }
    }
}


module.exports = Device;
