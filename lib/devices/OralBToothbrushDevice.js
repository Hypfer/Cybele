const util = require("util");
const Device = require("./Device");

/**
 *
 * @param options
 * @constructor
 */
const OralBToothbrushDevice = function OralBToothbrushDevice(options) {
    Device.call(this, options);

};

util.inherits(OralBToothbrushDevice, Device);

OralBToothbrushDevice.prototype.initialize = function(callback) {
    this.mqttClient.publish("homeassistant/sensor/toothbrush_" + this.id + "/config", JSON.stringify({
        "state_topic": "cybele/toothbrush/" + this.id + "/state",
        "json_attributes_topic": "cybele/toothbrush/" + this.id + "/attributes",
        "name": this.friendlyName,
        "unique_id": "cybele_toothbrush_" + this.id,
        "platform": "mqtt",
        "availability_topic": "cybele/toothbrush/" + this.id + "/presence",
        "icon": "mdi:tooth-outline"
    }), {retain: true}, err => {
        callback(err);
    });

};

OralBToothbrushDevice.prototype.handleAdvertisingForDevice = function(props) {
    Device.prototype.handleAdvertisingForDevice.call(this, props);

    if(props.ManufacturerData) {
        const parsedData = OralBToothbrushDevice.PARSE_TOOTHBRUSH_DATA(props.ManufacturerData);

        this.mqttClient.publish("cybele/toothbrush/" + this.id + "/presence", parsedData.state > 0 ? "online" : "offline", {retain: true});
        this.mqttClient.publish("cybele/toothbrush/" + this.id + "/state", OralBToothbrushDevice.STATES[parsedData.state], {retain: true});
        this.mqttClient.publish("cybele/toothbrush/" + this.id + "/attributes", JSON.stringify({
            rssi: props.RSSI,
            pressure: parsedData.pressure,
            time: parsedData.time,
            mode: OralBToothbrushDevice.MODES[parsedData.mode],
            sector: OralBToothbrushDevice.SECTORS[parsedData.sector]
        }), {retain: true});
    }
};

OralBToothbrushDevice.PARSE_TOOTHBRUSH_DATA = function(data) {
    return {
        state: data[3],
        pressure: data[4],
        time: data[5] * 60 + data[6],
        mode: data[7],
        sector: data[8]
    };
};

OralBToothbrushDevice.STATES = {
    0: "unknown",
    1: "initializing",
    2: "idle",
    3: "running",
    4: "charging",
    5: "setup",
    6: "flight_menu",
    113: "final_test",
    114: "pcb_test",
    115: "sleeping",
    116: "transport"
};

OralBToothbrushDevice.MODES = {
    0: "off",
    1: "daily_clean",
    2: "sensitive",
    3: "massage",
    4: "whitening",
    5: "deep_clean",
    6: "tongue_cleaning",
    7: "turbo",
    255: "unknown"
};

OralBToothbrushDevice.SECTORS = {
    1: "sector_1",
    2: "sector_2",
    3: "sector_3",
    4: "sector_4",
    5: "sector_5",
    6: "sector_6",
    7: "sector_7",
    8: "sector_8",
    15: "unknown_1",
    31: "unknown_2",
    23: "unknown_3",
    47: "unknown_4",
    55: "unknown_5",
    254: "last_sector",
    255: "no_sector"
};

module.exports = OralBToothbrushDevice;