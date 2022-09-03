const Semaphore = require("semaphore");

const DeviceFactory = require("./DeviceFactory");
const Dongle = require("./Dongle");
const ServiceFactory = require("./ServiceFactory");

class DongleFactory {
    /**
     *
     * @param {object} options
     * @param options.bus
     * @param options.mqttClient
     */
    constructor(options) {
        this.bus = options.bus;
        this.mqttClient = options.mqttClient;
    }

    /**
     *
     * @param {object} dongleConfig
     * @param {string} dongleConfig.hciDevice
     * @param {"le"|"bredr"|"auto"} dongleConfig.mode
     * @param {object} [dongleConfig.troubleshooting]
     * @param {number} [dongleConfig.troubleshooting.scanRestartInterval]
     * @param {object} [dongleConfig.troubleshooting.brickWatchdog]
     * @param {number} [dongleConfig.troubleshooting.brickWatchdog.timeout]
     * @param {string} [dongleConfig.troubleshooting.brickWatchdog.recoveryCommand]
     * @param {Array<object>} dongleConfig.services [Service configs]
     * @param {Array<object>} dongleConfig.devices [Device configs]
     * @returns {Promise<any>}
     */
    async manufacture(dongleConfig) {
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

        for (const serviceConfig of dongleConfig.services) {
            services.push(await serviceFactory.manufacture(serviceConfig));
        }

        for (const deviceConfig of dongleConfig.devices) {
            devices.push(await deviceFactory.manufacture(deviceConfig));
        }

        const dongle = new Dongle({
            bus: this.bus,
            hciDevice: dongleConfig.hciDevice,
            mode: dongleConfig.mode,
            troubleshooting: dongleConfig.troubleshooting,
            services: services,
            devices: devices,
            semaphore: semaphore
        });

        await dongle.initialize();

        return dongle;
    }
}


module.exports = DongleFactory;
