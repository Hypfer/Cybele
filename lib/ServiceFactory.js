const Services = require("./services");

class ServiceFactory {
    /**
     *
     * @param {object} options
     * @param options.bus
     * @param {string} options.hciDevice
     * @constructor
     */
    constructor(options) {
        this.bus = options.bus;
        this.hciDevice = options.hciDevice;
    }

    /**
     *
     * @param {object} serviceConfig
     * @param {string} serviceConfig.type
     * @returns {Promise<any>}
     */
    async manufacture(serviceConfig) {
        const ServiceConstructor = Services.SERVICE_BY_TYPE[serviceConfig.type];
        let service;

        if (typeof ServiceConstructor === "function") {
            service = new ServiceConstructor(Object.assign({},serviceConfig, {
                bus: this.bus,
                hciDevice: this.hciDevice
            }));

            await service.initialize();
            return service;
        } else {
            throw new Error("Invalid Service " + serviceConfig.type);
        }
    }

}

module.exports = ServiceFactory;
