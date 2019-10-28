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
                            this.initializeDongle(dongleConfig, err => {
                                if(err) {
                                    console.error(err);
                                } else {
                                    console.info("Successfully reinitialized dongle " + dongleConfig.hciDevice)
                                }
                            })
                        }, 5000);
                        //So we're basically just hoping that 5s are enough for the dongle to reappear on the USB bus
                        //TODO: Properly detect availability of dongles
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

module.exports = Cybele;