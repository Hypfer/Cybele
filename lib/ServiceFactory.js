const Services = require("./services");

/**
 *
 * @param options {object}
 * @param options.bus
 * @param options.hciDevice {string}
 * @constructor
 */
const ServiceFactory = function ServiceFactory(options) {
    this.bus = options.bus;
    this.hciDevice = options.hciDevice;
};

/**
 *
 * @param serviceConfig {object}
 * @param serviceConfig.type {string}
 * @param callback
 */
ServiceFactory.prototype.manufacture = function(serviceConfig, callback) {
    const ServiceConstructor = Services.SERVICE_BY_TYPE[serviceConfig.type];
    let service;

    if(typeof ServiceConstructor === "function") {
        service = new ServiceConstructor(Object.assign({},serviceConfig, {
            bus: this.bus,
            hciDevice: this.hciDevice
        }));

        service.initialize(err => {
            if(!err) {
                callback(null, service);
            } else {
                callback(err);
            }
        });
    } else {
        callback(new Error("Invalid Service " + serviceConfig.type));
    }
};

module.exports = ServiceFactory;