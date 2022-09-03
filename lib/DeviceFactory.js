const Devices = require("./devices");


class DeviceFactory {
    /**
     *
     * @param {object} options
     * @param options.bus
     * @param {string} options.hciDevice
     * @param options.mqttClient
     * @param {Semaphore} options.semaphore
     * @constructor
     */
    constructor(options) {
        this.bus = options.bus;
        this.hciDevice = options.hciDevice;
        this.mqttClient = options.mqttClient;
        this.semaphore = options.semaphore;
    }

    /**
     *
     * @param {object} deviceConfig
     * @param {string} deviceConfig.type
     * @returns {Promise<any>}
     */
    async manufacture(deviceConfig) {
        const DeviceConstructor = Devices.DEVICE_BY_TYPE[deviceConfig.type];
        let device;

        if (typeof DeviceConstructor === "function") {
            device = new DeviceConstructor(Object.assign({}, deviceConfig, {
                bus: this.bus,
                hciDevice: this.hciDevice,
                mqttClient: this.mqttClient,
                semaphore: this.semaphore
            }));

            await new Promise((resolve, reject) => {
                device.initialize(err => {
                    if (!err) {
                        resolve(device);
                    } else {
                        reject(err);
                    }
                });
            });

            return device;
        } else {
            throw new Error("Invalid Device " + deviceConfig.type);
        }
    }
}

module.exports = DeviceFactory;
