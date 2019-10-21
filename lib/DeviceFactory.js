const Devices = require("./devices");

/**
 *
 * @param options {object}
 * @param options.bus
 * @param options.hciDevice {string}
 * @param options.mqttClient
 * @param options.semaphore {Semaphore}
 * @constructor
 */
const DeviceFactory = function DeviceFactory(options) {
    this.bus = options.bus;
    this.hciDevice = options.hciDevice;
    this.mqttClient = options.mqttClient;
    this.semaphore = options.semaphore;
};

/**
 *
 * @param deviceConfig {object}
 * @param deviceConfig.type {string}
 * @param callback
 */
DeviceFactory.prototype.manufacture = function(deviceConfig, callback) {
    const DeviceConstructor = Devices.DEVICE_BY_TYPE[deviceConfig.type];
    let device;

    if(typeof DeviceConstructor === "function") {
        device = new DeviceConstructor(Object.assign({}, deviceConfig, {
            bus: this.bus,
            hciDevice: this.hciDevice,
            mqttClient: this.mqttClient,
            semaphore: this.semaphore
        }));

        device.initialize(err => {
            if(!err) {
                callback(null, device);
            } else {
                callback(err);
            }
        });
    } else {
        callback(new Error("Invalid Device " + deviceConfig.type));
    }
};

module.exports = DeviceFactory;