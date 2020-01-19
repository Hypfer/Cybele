const util = require("util");
const async = require("async");

const tools = require("../Tools");
const PollingDevice = require("./PollingDevice");

const MiFloraDevice = function MiFloraDevice(options) {
    PollingDevice.call(this, options);

    this.deviceInterface = null;
};

util.inherits(MiFloraDevice, PollingDevice);

MiFloraDevice.prototype.initialize = function(callback) {
    async.each([
        {
            topic: "homeassistant/sensor/miflora_" + this.id + "/" + this.id + "_battery/config",
            payload: {
                "state_topic": "cybele/miflora/" + this.id + "/state",
                "name": this.friendlyName + " Battery",
                "unique_id": "cybele_miflora_battery_" + this.id,
                "device_class": "battery",
                "unit_of_measurement": "%",
                "value_template": "{{ value_json.battery }}"
            }
        },
        {
            topic: "homeassistant/sensor/miflora_" + this.id + "/" + this.id + "_temperature/config",
            payload: {
                "state_topic": "cybele/miflora/" + this.id + "/state",
                "name": this.friendlyName + " Temperature",
                "unique_id": "cybele_miflora_temperature_" + this.id,
                "device_class": "temperature",
                "unit_of_measurement": "°C",
                "value_template": "{{ value_json.temperature }}"
            }
        },
        {
            topic: "homeassistant/sensor/miflora_" + this.id + "/" + this.id + "_illuminance/config",
            payload: {
                "state_topic": "cybele/miflora/" + this.id + "/state",
                "name": this.friendlyName + " Illuminance",
                "unique_id": "cybele_miflora_illuminance_" + this.id,
                "device_class": "illuminance",
                "unit_of_measurement": "lux",
                "value_template": "{{ value_json.illuminance }}"
            }
        },
        {
            topic: "homeassistant/sensor/miflora_" + this.id + "/" + this.id + "_moisture/config",
            payload: {
                "state_topic": "cybele/miflora/" + this.id + "/state",
                "name": this.friendlyName + " Moisture",
                "unique_id": "cybele_miflora_moisture_" + this.id,
                "device_class": "humidity",
                "unit_of_measurement": "%",
                "value_template": "{{ value_json.moisture }}"
            }
        },
        {
            topic: "homeassistant/sensor/miflora_" + this.id + "/" + this.id + "_conductivity/config",
            payload: {
                "state_topic": "cybele/miflora/" + this.id + "/state",
                "name": this.friendlyName + " Conductivity",
                "unique_id": "cybele_miflora_conductivity_" + this.id,
                "unit_of_measurement": "µS/cm",
                "value_template": "{{ value_json.conductivity }}"
            }
        }
    ], (autoconfigEntry, done) => {
        this.mqttClient.publish(
            autoconfigEntry.topic,
            JSON.stringify(autoconfigEntry.payload),
            {retain: true},
            err => {
                done(err);
        });
    }, err => {
        if(!err) {
            this.queuePolling();
        }

        callback(err);
    });
};

MiFloraDevice.prototype.poll = async function() {
    let fwInfo;
    let reading;

    try {
        if(!this.deviceInterface) {
            this.deviceInterface = await this.getDBusInterfaceAsync(
                this.pathRoot + "/dev_" + this.macInDbusNotation,
                "org.bluez.Device1"
            );
        }
    } catch(e) {
        //If there is no interface, it means that the device is out of range
        return this.queuePolling();
    }

    try {
        await this.connectDeviceAsync(this.deviceInterface, 5000, 5); //TODO: configurable?
    } catch(e) {
        console.error(e);
        return this.queuePolling();
    }

    try {
        await this.writeCharacteristicAsync(
            this.characteristicsByUUID[MiFloraDevice.CHARACTERISTICS.deviceMode],
            MiFloraDevice.LIVE_MODE_CMD,
            "request"
        );
    } catch(e) {
        console.error(e);
        return this.queuePolling();
    }

    try {
        fwInfo = MiFloraDevice.PARSE_FIRMWARE_CHARACTERISTIC(
            await this.readCharacteristicAsync( this.characteristicsByUUID[MiFloraDevice.CHARACTERISTICS.firmware])
        );

        this.queuePolling();
    } catch (e) {
        console.error(e);
        return this.queuePolling();
    }

    //According to this issue, the blinking on connect messes up the readings which can be solved by waiting a little
    //https://github.com/open-homeautomation/miflora/issues/136#issuecomment-549128076
    await tools.sleep(5000);

    try {
        reading = MiFloraDevice.PARSE_DATA(
            await this.readCharacteristicAsync( this.characteristicsByUUID[MiFloraDevice.CHARACTERISTICS.sensorData])
        );
    } catch(e) {
        console.error(e);
        return this.queuePolling();
    }


    if(reading && fwInfo) {
        this.mqttClient.publish("cybele/miflora/" + this.id + "/state", JSON.stringify({
            battery: fwInfo.batteryPct,
            temperature: reading.temp,
            illuminance: reading.brightness,
            moisture: reading.moisture,
            conductivity: reading.conductivity
        }), {retain: true}, err => {
            if(err) {
                console.error(err);
            }
        })
    } else {
        console.info("Got invalid or missing data for " + this.friendlyName, reading, fwInfo);
    }

    this.queuePolling();
};

MiFloraDevice.LIVE_MODE_CMD = Buffer.from([0xA0, 0x1F]);

MiFloraDevice.PARSE_DATA = function(buf) {
    if(buf && buf.length === 16) {
        const temp = buf.readUInt16LE(0) / 10;

        if(temp < 200) { //For some reason, some readings are trash. We're using the temperature to validate
            return {
                temp: temp,
                brightness: buf.readUInt32LE(3),
                moisture: buf.readUInt8(7),
                conductivity: buf.readUInt16LE(8)
            }
        }
    }
};

MiFloraDevice.PARSE_FIRMWARE_CHARACTERISTIC = function(buf) {
    if(buf && buf.length === 7) {
        return {
            batteryPct: buf.readUInt8(0),
            firmwareVersion: buf.toString("ascii", 2)
        }
    }
};

MiFloraDevice.CHARACTERISTICS = {
    deviceMode: "00001a00-0000-1000-8000-00805f9b34fb",
    sensorData: "00001a01-0000-1000-8000-00805f9b34fb",
    firmware: "00001a02-0000-1000-8000-00805f9b34fb"
};

module.exports = MiFloraDevice;