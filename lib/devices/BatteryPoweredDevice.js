const PollingDevice = require("./PollingDevice");

class BatteryPoweredDevice extends PollingDevice {
    /**
     *
     * @param {object} options
     * @param {number} options.pollingInterval
     * @param {boolean} options.disconnectAfterFetch
     * @param {number} [options.maxDelayAfterConnect]
     */
    constructor(options) {
        super(options);

        this.disconnectAfterFetch = options.disconnectAfterFetch;
        this.maxDelayAfterConnect = options.maxDelayAfterConnect !== undefined ? options.maxDelayAfterConnect : 5000;
    }

    initialize(callback) {
        this.mqttClient.publish("homeassistant/sensor/bat_" + this.id + "/config", JSON.stringify({
            "state_topic": BatteryPoweredDevice.MQTT_PREFIX + this.id + "/state",
            "name": this.friendlyName + " Battery",
            "unique_id": "cybele_bat_" + this.id,
            "platform": "mqtt",
            "unit_of_measurement": "%",
            "device_class": "battery"
        }), {retain: true}, err => {
            if (!err) {
                this.queuePolling();
            }

            callback(err);
        });
    }

    async poll() { //TODO: PollingDevice.poll isn't async yet
        let deviceInterface;
        let batteryInterface;

        try {
            deviceInterface = await this.getDBusInterfaceAsync(
                this.pathRoot + "/dev_" + this.macInDbusNotation,
                "org.bluez.Device1"
            );
        } catch (e) {
            //If there is no interface, it means that the device is out of range
            return this.queuePolling();
        }

        try {
            await this.connectDeviceAsync(deviceInterface, this.maxDelayAfterConnect);
        } catch (e) {
            if (this.disconnectAfterFetch) {
                await this.takeSemaphoreAsync();
                deviceInterface.Disconnect(err => {
                    this.semaphore.leave();
                    if (err) {
                        console.error(err);
                    }

                    this.queuePolling();
                });
            } else {
                this.queuePolling();
            }

            return;
        }

        try {
            batteryInterface = await this.getDBusInterfaceAsync(
                this.pathRoot + "/dev_" + this.macInDbusNotation,
                "org.bluez.Battery1"
            );
        } catch (e) {
            console.error(e);

            if (this.disconnectAfterFetch) {
                await this.takeSemaphoreAsync();

                return deviceInterface.Disconnect(err => {
                    this.semaphore.leave();
                    if (err) {
                        console.error(err);
                    }

                    this.queuePolling();
                });
            } else {
                return this.queuePolling();
            }
        }

        batteryInterface.Percentage(async (err, value) => {
            if (!err && value) {
                this.mqttClient.publish(BatteryPoweredDevice.MQTT_PREFIX + this.id +"/state", value.toString(), {retain: true}, err => {
                    if (err) {
                        console.error(err);
                    }
                }
                );
            }

            if (this.disconnectAfterFetch) {
                await this.takeSemaphoreAsync();
                deviceInterface.Disconnect(err => {
                    this.semaphore.leave();
                    if (err) {
                        console.error(err);
                    }

                    this.queuePolling();
                });
            } else {
                this.queuePolling();
            }
        });
    }
}

BatteryPoweredDevice.MQTT_PREFIX = "cybele/battery_powered_ble_device/";

module.exports = BatteryPoweredDevice;
