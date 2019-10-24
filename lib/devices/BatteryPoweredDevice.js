const util = require("util");
const tools = require("../Tools");
const Device = require("./Device");

/**
 *
 * @param options
 * @param options.pollingInterval {number}
 * @param options.disconnectAfterFetch {boolean}
 * @param [options.delayAfterConnect] {number}
 * @constructor
 */
const BatteryPoweredDevice = function BatteryPoweredDevice(options) {
    Device.call(this, options);

    this.pollingInterval = options.pollingInterval;
    this.disconnectAfterFetch = options.disconnectAfterFetch;
    this.delayAfterConnect = options.delayAfterConnect !== undefined ? options.delayAfterConnect : 0;
};

util.inherits(BatteryPoweredDevice, Device);

BatteryPoweredDevice.prototype.initialize = function(callback) {
    this.mqttClient.publish("homeassistant/sensor/bat_" + this.id + "/config", JSON.stringify({
        "state_topic": "battery_powered_ble_device/" + this.id +"/state",
        "name": this.friendlyName + " Battery",
        "platform": "mqtt",
        "unit_of_measurement": "%",
        "device_class": "battery"
    }), {retain: true}, err => {
        if(!err) {
            this.queuePolling();
        }

        callback(err);
    })
};

BatteryPoweredDevice.prototype.queuePolling = function() {
    setTimeout(() => {
        this.poll().then();
    }, this.pollingInterval);
};

BatteryPoweredDevice.prototype.poll = async function() {
    let deviceInterface;
    let batteryInterface;

    try {
        deviceInterface = await this.getDBusInterfaceAsync(
            this.pathRoot + "/dev_" + this.macInDbusNotation,
            "org.bluez.Device1"
        )
    } catch(e) {
        console.error(e);
        return this.queuePolling();
    }

    await this.takeSemaphoreAsync();

    try {
        await this.connectDeviceAsync(deviceInterface);
    } catch(e) {
        this.semaphore.leave();
        console.error(e);
        return this.queuePolling();
    }

    this.semaphore.leave();
    await tools.sleep(this.delayAfterConnect);

    try {
        batteryInterface = await this.getDBusInterfaceAsync(
            this.pathRoot + "/dev_" + this.macInDbusNotation,
            "org.bluez.Battery1"
        );
    } catch (e) {
        console.error(e);
        return this.queuePolling();
    }

    batteryInterface.Percentage(async (err, value) => {
        if(!err && value) {
            this.mqttClient.publish("homeassistant/sensor/bat_" + this.id +"/state", value.toString(), {}, err => {
                    if(err) {
                        console.error(err);
                    }
                }
            );
        }

        if(this.disconnectAfterFetch) {
            await this.takeSemaphoreAsync();
            deviceInterface.Disconnect(err => {
                this.semaphore.leave();
                if(err) {
                    console.error(err);
                }

                this.queuePolling();
            })
        } else {
            this.queuePolling();
        }
    });
};

module.exports = BatteryPoweredDevice;