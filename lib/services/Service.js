
/**
 * @param options {object}
 * @param options.bus
 * @param options.hciDevice {string}
 * @constructor
 */
const Service = function Service(options) {
    this.bus = options.bus;
    this.hciDevice = options.hciDevice;
};

Service.prototype.initialize = function(callback) {
    callback();
};

module.exports = Service;