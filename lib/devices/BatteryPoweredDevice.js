const util = require("util");
const Device = require("./Device");

/**
 *
 * @param options
 * @param options.pollingInterval {number}
 * @param options.disconnectAfterFetch {boolean}
 * @param [options.delayAfterConnect] {number}
 * @constructor
 */
const BatteryPoweredDevice = function BatteryPoweredDevice(options) {
    Device.call(this, options);

    this.pollingInterval = options.pollingInterval;
    this.disconnectAfterFetch = options.disconnectAfterFetch;
    this.delayAfterConnect = options.delayAfterConnect !== undefined ? options.delayAfterConnect : 0;
};

util.inherits(BatteryPoweredDevice, Device);

BatteryPoweredDevice.prototype.initialize = function(callback) {
    this.mqttClient.publish("homeassistant/sensor/bat_" + this.id + "/config", JSON.stringify({
        "state_topic": "battery_powered_ble_device/" + this.id +"/state",
        "name": this.friendlyName + " Battery",
        "platform": "mqtt",
        "unit_of_measurement": "%",
        "device_class": "battery"
    }), {retain: true}, err => {
        if(!err) {
            setTimeout(() => {
                this.poll();
            }, this.pollingInterval);
        }

        callback(err);
    })

};

BatteryPoweredDevice.prototype.poll = function() {
    const self = this;

    this.blueZservice.getInterface(
        this.pathRoot + "/dev_" + this.macInDbusNotation,
        "org.bluez.Device1",
        (err, deviceInterface) => {
            err = Array.isArray(err) ? err.join(".") : err;

            if(!err && deviceInterface) {
                this.semaphore.take(() => {
                    this.deviceInterface.Connect(err => {
                        if(!err) {
                            setTimeout(() => {
                                self.blueZservice.getInterface(
                                    self.pathRoot + "/dev_" + self.macInDbusNotation,
                                    "org.bluez.Battery1",
                                    (err, batteryInterface) => {
                                        if(!err && batteryInterface) {
                                            batteryInterface.Percentage((err, value) => {
                                                if(!err && value) {
                                                    self.mqttClient.publish(
                                                        "homeassistant/sensor/bat_" + this.id +"/state",
                                                        value.toString(),
                                                        {},
                                                        err => {
                                                            if(err) {
                                                                console.error(err);
                                                            }
                                                        }
                                                    );
                                                }

                                                if(self.disconnectAfterFetch) {
                                                    this.deviceInterface.Disconnect(err => {
                                                        if(err) {
                                                            console.error(Array.isArray(err) ? err.join(".") : err);
                                                        }

                                                        done();
                                                    })
                                                } else {
                                                    done();
                                                }
                                            });
                                        } else {
                                            if(err) {
                                                console.error(Array.isArray(err) ? err.join(".") : err);

                                                done();
                                            } else {
                                                console.error("Missing battery interface for " + self.friendlyName);

                                                if(self.disconnectAfterFetch) {
                                                    this.deviceInterface.Disconnect(err => {
                                                        if(err) {
                                                            console.error(Array.isArray(err) ? err.join(".") : err);
                                                        }

                                                        done();
                                                    })
                                                } else {
                                                    done();
                                                }
                                            }
                                        }
                                    }
                                );
                            }, self.delayAfterConnect);
                        } else {
                            console.error(err);
                            done();
                        }
                    });
                })
            }
        }
    );


    function done() {
        self.semaphore.leave();
        setTimeout(() => {
            self.poll();
        }, self.pollingInterval);
    }
};

module.exports = BatteryPoweredDevice;