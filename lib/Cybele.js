const dbus = require('dbus-native');
const async = require("async");

const DongleFactory = require("./DongleFactory");

const bus = dbus.systemBus();

/**
 * @param options {object}
 * @param options.mqttClient
 * @param options.config
 * @constructor
 */
const Cybele = function Cybele(options) {
    this.config = options.config;
    this.mqttClient = options.mqttClient;
    this.blueZservice = bus.getService('org.bluez');
    this.pathRoot = '/org/bluez/';

    this.dongleFactory = new DongleFactory({
        bus: bus,
        mqttClient: this.mqttClient
    });

    this.dongleConfigs = {};
    this.dongles = {};

};

Cybele.prototype.initialize = function(callback) {
    async.each(this.config.dongles, (dongleConfig, done) => {
        this.initializeDongle(dongleConfig, done);
    }, callback);
};

Cybele.prototype.initializeDongle = function(dongleConfig, callback) {
    this.dongleConfigs[dongleConfig.hciDevice] = dongleConfig;

    this.dongleFactory.manufacture(dongleConfig, (err, dongle) => {
        if(!err) {
            this.dongles[dongleConfig.hciDevice] = dongle;

            dongle.on("death", msg => {
                console.info("Dongle " + dongleConfig.hciDevice + " died");

                dongle.destroy(err => {
                    if(err) {
                        console.error(err); //TODO
                    } else {
                        delete(this.dongles[dongleConfig]);

                        setTimeout(() => {
                            this.asyncWaitForDongle(dongleConfig.hciDevice, 15000).then(() => {
                                this.initializeDongle(dongleConfig, err => {
                                    if(err) {
                                        console.error(err);
                                    } else {
                                        console.info("Successfully reinitialized dongle " + dongleConfig.hciDevice)
                                    }
                                })
                            }).catch(err => {
                                console.error({
                                    msg: "FATAL: Failed to reinitialize dongle " + dongleConfig.hciDevice,
                                    err: err
                                })
                            });
                        }, 2000)
                        //Wait 2s for the dongle to disappear completely
                    }
                })
            });

            callback();
        } else {
            callback({
                dongleConfig: dongleConfig,
                error: err
            });
        }
    })
};

Cybele.prototype.asyncWaitForDongle = function(hciDevice, timeout) {
    const self = this;
    const start_time = new Date().getTime();

    timeout = typeof timeout === "number" && timeout > 0 ? timeout : 10000;

    return new Promise(async function(resolve, reject) {
        while (true) {
            let result;

            if (new Date().getTime() > start_time + timeout) {
                return reject("Timeout exceeded")
            }

            result = await new Promise((resolve, reject) => {
                self.blueZservice.getInterface(
                    self.pathRoot + hciDevice,
                    "org.bluez.Adapter1",
                    (err, adapterInterface) => {
                        if(!err && adapterInterface) {
                            return resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
            });

            if(result === true) {
                return resolve(true);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }
    });
};

module.exports = Cybele;