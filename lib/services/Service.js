

class Service {
    /**
     * @param {object} options
     * @param options.bus
     * @param {string} options.hciDevice
     * @constructor
     */
    constructor(options) {
        this.bus = options.bus;
        this.hciDevice = options.hciDevice;
    }

    async initialize() {
        // Implement me
    }

    async destroy() {
        // Implement me
    }
}

module.exports = Service;
