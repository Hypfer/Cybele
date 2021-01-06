const util = require("util");
const Device = require("./Device");
const async = require("async");

/**
 *
 * @param options
 * @constructor
 */
const MiLYWSD03MMCDevice = function MiLYWSD03MMCDevice(options) {
    Device.call(this, options);
};

util.inherits(MiLYWSD03MMCDevice, Device);

MiLYWSD03MMCDevice.prototype.initialize = function(callback) {
    async.each([
        {
            topic: "homeassistant/sensor/MiLYWSD03MMC/" + this.id + "_tem/config",
            payload: {
                "state_topic": "cybele/MiLYWSD03MMC/" + this.id + "/state",
                "name": this.friendlyName + " Temperature",
                "unique_id": "cybele_temp_" + this.id,
                "platform": "mqtt",
                "unit_of_measurement": "°C",
                "device_class": "temperature",
                "value_template": "{{ value_json.tempc }}"
            }
        },
        {
            topic: "homeassistant/sensor/MiLYWSD03MMC/" + this.id + "_hum/config",
            payload: {
                "state_topic": "cybele/MiLYWSD03MMC/" + this.id + "/state",
                "name": this.friendlyName + " Humidity",
                "unique_id": "cybele_hum_" + this.id,
                "platform": "mqtt",
                "unit_of_measurement": "%",
                "device_class": "humidity",
                "value_template": "{{ value_json.hum }}"
            }
        },
        {
            topic: "homeassistant/sensor/MiLYWSD03MMC/" + this.id + "_bat/config",
            payload: {
                "state_topic": "cybele/MiLYWSD03MMC/" + this.id + "/state",
                "name": this.friendlyName + " Battery percent",
                "unique_id": "cybele_bat_" + this.id,
                "platform": "mqtt",
                "unit_of_measurement": "%",
                "device_class": "battery",
                "value_template": "{{ value_json.batt }}"
            }
        },
        {
            topic: "homeassistant/sensor/MiLYWSD03MMC/" + this.id + "_batv/config",
            payload: {
                "state_topic": "cybele/MiLYWSD03MMC/" + this.id + "/state",
                "name": this.friendlyName + " Battery Volt",
                "unique_id": "cybele_bat_" + this.id,
                "platform": "mqtt",
                "unit_of_measurement": "V",
                "device_class": "battery",
                "value_template": "{{ value_json.volt }}"
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
        callback(err);
    });
};

MiLYWSD03MMCDevice.prototype.handleAdvertisingForDevice = function(props) {
    Device.prototype.handleAdvertisingForDevice.call(this, props);
    if(
      props.ServiceData &&
      props.ServiceData.UUID === "0000181a-0000-1000-8000-00805f9b34fb" &&
      Buffer.isBuffer(props.ServiceData.data)
    ) {
        const parsedData = this.parseServiceData(props.ServiceData.data);
        if (parsedData) {
            this.mqttClient.publish("cybele/MijiaLYWSD03MMC/" + this.id + "/state", JSON.stringify(parsedData), {retain: true});
        }
    }
};

MiLYWSD03MMCDevice.prototype.parseServiceData = function(data) {
    return {
        tempc: data.readUIntBE(6,2)/10,
        hum: data.readUInt8(8),
        batt: data.readUInt8(9),
        volt: data.readUInt16BE(10)/1000
    };
};

module.exports = MiLYWSD03MMCDevice;