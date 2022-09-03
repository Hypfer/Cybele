const dbus = require("dbus-native");

const DongleFactory = require("./DongleFactory");

const bus = dbus.systemBus();


class Cybele {
    /**
     * @param {object} options
     * @param options.mqttClient
     * @param options.config
     */
    constructor(options) {
        this.config = options.config;
        this.mqttClient = options.mqttClient;
        this.blueZservice = bus.getService("org.bluez");
        this.pathRoot = "/org/bluez/";

        this.dongleFactory = new DongleFactory({
            bus: bus,
            mqttClient: this.mqttClient
        });

        this.dongles = {};
    }

    async initialize() {
        for (const dongle of this.config.dongles) {
            await this.initializeDongle(dongle);
        }
    }

    async initializeDongle(dongleConfig) {
        const dongle = await this.dongleFactory.manufacture(dongleConfig);

        this.dongles[dongleConfig.hciDevice] = dongle;

        dongle.on("death", msg => {
            console.info("Dongle " + dongleConfig.hciDevice + " died");

            dongle.destroy().then(() => {
                delete(this.dongles[dongleConfig]);

                setTimeout(() => {
                    this.asyncWaitForDongle(dongleConfig.hciDevice, 15000).then(() => {
                        this.initializeDongle(dongleConfig, err => {
                            if (err) {
                                console.error(err);
                            } else {
                                console.info("Successfully reinitialized dongle " + dongleConfig.hciDevice);
                            }
                        });
                    }).catch(err => {
                        console.error({
                            msg: "FATAL: Failed to reinitialize dongle " + dongleConfig.hciDevice,
                            err: err
                        });
                    });
                }, 2500);
                //Wait 2.5s for the dongle to disappear completely
            }).catch(err => {
                console.error(err); //TODO
            });
        });
    }

    asyncWaitForDongle(hciDevice, timeout) {
        const self = this;
        const start_time = new Date().getTime();

        timeout = typeof timeout === "number" && timeout > 0 ? timeout : 10000;

        return new Promise(async function(resolve, reject) {
            while (true) {
                let result;

                if (new Date().getTime() > start_time + timeout) {
                    return reject("Timeout exceeded");
                }

                result = await new Promise((resolve, reject) => {
                    self.blueZservice.getInterface(
                        self.pathRoot + hciDevice,
                        "org.bluez.Adapter1",
                        (err, adapterInterface) => {
                            if (!err && adapterInterface) {
                                return resolve(true);
                            } else {
                                resolve(false);
                            }
                        });
                });

                if (result === true) {
                    return resolve(true);
                }

                await new Promise(resolve => {
                    return setTimeout(resolve, 100);
                });
            }
        });
    }
}

module.exports = Cybele;
