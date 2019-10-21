const async = require("async");
const Semaphore = require("semaphore");

const Dongle = require("./Dongle");
const ServiceFactory = require("./ServiceFactory");
const DeviceFactory = require("./DeviceFactory");

/**
 *
 * @param options
 * @param options.bus
 * @param options.mqttClient
 * @constructor
 */
const DongleFactory = function DongleFactory(options) {
    this.bus = options.bus;
    this.mqttClient = options.mqttClient;
};

/**
 *
 * @param dongleConfig {object}
 * @param dongleConfig.hciDevice {string}
 * @param dongleConfig.mode {"le"|"bredr"|"auto"}
 * @param dongleConfig.services {Array<object>} [Service configs]
 * @param dongleConfig.devices {Array<object>} [Device configs]
 * @param callback {function}
 * @returns Dongle
 */
DongleFactory.prototype.manufacture = function(dongleConfig, callback) {
    const services = [];
    const devices = [];
    const semaphore = new Semaphore(1);
    const serviceFactory = new ServiceFactory({
        bus: this.bus,
        hciDevice: dongleConfig.hciDevice
    });
    const deviceFactory = new DeviceFactory({
        bus: this.bus,
        hciDevice: dongleConfig.hciDevice,
        mqttClient: this.mqttClient,
        semaphore: semaphore
    });

    let dongle;

    async.each(dongleConfig.services, (config, done) => {
        serviceFactory.manufacture(config, (err, service) => {
            if(!err) {
                services.push(service);
            }

            done(err);
        });
    }, err => {
        if(!err) {
            async.each(dongleConfig.devices, (config, done) => {
                deviceFactory.manufacture(config, (err, device) => {
                    if(!err) {
                        devices.push(device);
                    }

                    done(err);
                })
            }, err => {
                if(!err) {
                    dongle = new Dongle({
                        bus: this.bus,
                        hciDevice: dongleConfig.hciDevice,
                        mode: dongleConfig.mode,
                        services: services,
                        devices: devices
                    });

                    dongle.initialize(err => {
                        callback(err, dongle);
                    })
                } else {
                    callback(err);
                }
            });
        } else {
            callback(err);
        }
    });
};


module.exports = DongleFactory;