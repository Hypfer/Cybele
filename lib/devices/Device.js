const xml2js = require('xml2js');
const async = require("async");

/**
 *
 * @param options {object}
 * @param options.friendlyName {string}
 * @param options.mac {string}
 * @param options.bus {string}
 * @param options.hciDevice {string}
 * @param options.semaphore {Semaphore}
 * @param options.mqttClient
 * @constructor
 */
const Device = function Device(options) {
    this.friendlyName = options.friendlyName;
    this.mac = options.mac;
    this.macInDbusNotation = this.mac.split(":").map(e => e.toUpperCase()).join("_");

    this.bus = options.bus;
    this.hciDevice = options.hciDevice;
    this.semaphore = options.semaphore;
    this.mqttClient = options.mqttClient;
    this.blueZservice = this.bus.getService('org.bluez');
    this.pathRoot = '/org/bluez/' + this.hciDevice;

    this.id = this.mac.toLowerCase().split(":").join("");

    this.connected = false;
    this.servicesResolved = false;
    this.characteristicsByUUID = {};
    this.handlesByUUID = {};
};

Device.prototype.handleDbusMessage = function(type, dev, props) {
    //This might be overwritten by devices
    if(dev === "dev_" + this.macInDbusNotation) {
        switch(type) {
            case "org.bluez.Device1":
                this.handleAdvertisingForDevice(props);
                break;
            case "org.bluez.GattCharacteristic1":
                this.handleNotificationForDevice(props);
                break;
        }
    }
};

/**
 *
 * @param props {object}
 * @param [props.RSSI] {number}
 * @param [props.Name] {string}
 * @param [props.Alias] {string}
 * @param [props.Connected] {bool}
 * @param [props.ServicesResolved] {bool}
 * @param [props.ManufacturerData] {Buffer}
 * @param [props.ServiceData] {object}
 * @param props.ServiceData.UUID {string}
 * @param props.ServiceData.data {Buffer}
 */
Device.prototype.handleAdvertisingForDevice = function(props) {
    if(props.Connected !== undefined) {
        this.connected = props.Connected;
    }

    if(props.ServicesResolved !== undefined) {
        this.servicesResolved = props.ServicesResolved;
    }


    //This will be overwritten by devices. Dont forget to call this in the device implementation
};

Device.prototype.handleNotificationForDevice = function(props) {
    //This will be overwritten by devices
};

Device.prototype.handleMqttMessage = function(topic, message) {
    if(this.mqttHandler) {
        this.mqttHandler.handleMessage(topic, message);
    }
};

Device.prototype.initialize = function(callback) {
    callback();
    //Here, mqtt autodiscovery setup happens
};

Device.prototype.takeSemaphoreAsync = function() {
    const self = this;

    return new Promise(function(resolve, reject){
        self.semaphore.take(() => {
            resolve();
        })
    })
};

Device.prototype.getDBusInterfaceAsync = function(path, ifaceName) {
    const self = this;

    return new Promise(function(resolve, reject) {
        self.blueZservice.getInterface(path, ifaceName, function(err, iface) {
            err = Array.isArray(err) ? err.join(".") : err;

            if(!err && iface) {
                resolve(iface)
            } else {
                reject({
                    message: "Failed to get Interface " + ifaceName + " for " + path,
                    error: err
                })
            }
        });
    });
};

Device.prototype.connectDeviceAsync = function(deviceInterface, timeout, retries) {
    const self = this;
    let retryCount = 0;

    retries = typeof retries === "number" ? retries : 0;

    function connectHelper(callback) {
        self.semaphore.take(() => {
            deviceInterface.Connect(async function(err) {
                self.semaphore.leave();
                err = Array.isArray(err) ? err.join(".") : err;

                if(!err) { //Handle devices which are already connected on startup
                    deviceInterface.ServicesResolved(async (err, resolved) => {
                        if(!err) {
                            if(resolved === false) {
                                try {
                                    await self.waitForServicesResolved(timeout);
                                } catch(e) {
                                    return errorHelper(e, callback);
                                }
                            } else {
                                self.servicesResolved = true;
                            }

                            try {
                                await self.mapServicesAsync();
                                callback();
                            } catch(e) {
                                return errorHelper(e, callback);
                            }
                        } else {
                            errorHelper(err, callback);
                        }
                    })


                } else {
                    self.connected = false; //Not sure if this is needed.

                    errorHelper(err, callback);
                }
            });
        })
    }

    function errorHelper(err, callback) {
        if(retryCount < retries) {
            console.info("Connection to " + self.friendlyName + " failed. Retrying. Error: " + err);
            retryCount++;
            connectHelper(callback)
        } else {
            callback(err);
        }
    }

    return new Promise(function(resolve, reject) {
        if(deviceInterface) {
            connectHelper(err => {
                if(!err) {
                    resolve();
                } else {
                    reject({
                        message: "Failed to connect to " + self.friendlyName,
                        error: err
                    })
                }
            })
        } else {
            reject({
                message: "Missing deviceInterface"
            });
        }
    });
};

Device.prototype.readCharacteristicAsync = function(characteristicInterface) {
    const self = this;

    return new Promise(async function(resolve, reject){
        if(characteristicInterface) {
            await self.takeSemaphoreAsync();
            characteristicInterface.ReadValue({}, (err, data) => {
                self.semaphore.leave();
                err = Array.isArray(err) ? err.join(".") : err;

                if(!err) {
                    resolve(data);
                } else {
                    reject(err);
                }
            })
        } else {
            reject({
                message: "Missing characteristicInterface"
            })
        }

    })
};

Device.prototype.writeCharacteristicAsync = function(characteristicInterface, payload, mode) {
    const self = this;

    return new Promise(async function(resolve, reject){
        if(characteristicInterface) {
            await self.takeSemaphoreAsync();
            characteristicInterface.WriteValue(payload, {type: mode}, err => {
                self.semaphore.leave();
                err = Array.isArray(err) ? err.join(".") : err;

                if(!err) {
                    resolve();
                } else {
                    reject(err);
                }
            })
        } else {
            reject({
                message: "Missing characteristicInterface"
            })
        }

    })
};

Device.prototype.destroy = function(callback) {
    callback();
};

Device.prototype.waitForServicesResolved = function (timeout) {
    const self = this;
    const start_time = new Date().getTime();

    timeout = typeof timeout === "number" && timeout > 0 ? timeout : 10000;

    return new Promise(async function(resolve, reject) {
        while (true) {
            if (self.servicesResolved === true) {
                return resolve(true);
            }

            if (new Date().getTime() > start_time + timeout) {
                return reject("Timeout exceeded")
            }

            await new Promise(resolve => setTimeout(resolve, 10));
        }
    });
};

Device.prototype.introspectPathAsync = function(path) {
    const self = this;

    return new Promise(async function(resolve, reject){
        let iface;

        try {
            iface = await self.getDBusInterfaceAsync(path, "org.freedesktop.DBus.Introspectable");
        } catch(e) {
            return reject({
                message: "Failed to get introspection interface",
                error: e
            })
        }

        iface.Introspect((err, result) => {
            if(!err && typeof result === "string" && result.length > 0 && result[0] === "<") {
                xml2js.parseString(result, (err, parsedResult) => {
                    if(!err && parsedResult) {
                        resolve(parsedResult);
                    } else {
                        reject({
                            message: "Failed to parse result",
                            error: err
                        })
                    }
                })
            } else {
                reject({
                    message: "Failed to introspect",
                    error: err,
                    result: result
                })
            }
        })

    })
};

Device.prototype.mapServicesAsync = function() {
    const self = this;


    return new Promise(async function(resolve, reject) {
        let services;

        try {
            services = await self.introspectPathAsync(self.pathRoot + "/dev_" + self.macInDbusNotation)
        } catch(e) {
            return reject(e);
        }

        // noinspection DuplicatedCode
        if(services && services.node && Array.isArray(services.node.node)) {
            services = services.node.node.map(e => {
                if(e["$"] && e["$"].name) {
                    return e["$"].name;
                } else {
                    return false;
                }
            }).filter(e => e !== false);
        } else {
            services = [];
        }

        await async.each(services, (service, done) => {
            self.mapCharacteristicsAsync(service).then(() => done()).catch(err => done(err));
        }, err => {
            if(!err) {
                resolve();
            } else {
                reject({
                    error: err
                })
            }
        })
    });
};

Device.prototype.mapCharacteristicsAsync = function(service) {
    const self = this;


    return new Promise(async function(resolve, reject) {
        let characteristics;

        try {
            characteristics = await self.introspectPathAsync(
                self.pathRoot + "/dev_" + self.macInDbusNotation + "/" + service
            )
        } catch(e) {
            return reject(e);
        }

        // noinspection DuplicatedCode
        if(characteristics && characteristics.node && Array.isArray(characteristics.node.node)) {
            characteristics = characteristics.node.node.map(e => {
                if(e["$"] && e["$"].name) {
                    return e["$"].name;
                } else {
                    return false;
                }
            }).filter(e => e !== false);
        } else {
            characteristics = [];
        }

        await async.each(characteristics, function(characteristic, done) {
            self.getDBusInterfaceAsync(
                    self.pathRoot + "/dev_" + self.macInDbusNotation + "/" + service + "/" + characteristic,
                    "org.bluez.GattCharacteristic1"
            ).then(characteristicIface => {
                characteristicIface.UUID((err, uuid) => {
                    if(!err && uuid) {
                        self.characteristicsByUUID[uuid] = characteristicIface;
                        self.handlesByUUID[uuid] = service + "/" + characteristic;

                        done();
                    } else {
                        done({
                            message: "Failed to fetch uuid for characteristic" + characteristic,
                            error: err
                        });
                    }
                })
            }).catch(err => {done(err)});
        }, err => {
            if(!err) {
                resolve();
            } else {
                reject({
                    error: err
                })
            }
        });
    });
};

module.exports = Device;