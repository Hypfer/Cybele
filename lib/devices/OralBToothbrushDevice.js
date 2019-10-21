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
        "state_topic": "toothbrush/" + this.id + "/state",
        "json_attributes_topic": "toothbrush/" + this.id + "/attributes",
        "name": this.friendlyName,
        "platform": "mqtt",
        "availability_topic": "toothbrush/" + this.id + "/presence",
        "icon": "mdi:tooth-outline"
    }), {retain: true}, err => {
        callback(err);
    });

};

OralBToothbrushDevice.prototype.handleAdvertisingForDevice = function(prop) {
    if(prop.ManufacturerData) {
        const parsedData = OralBToothbrushDevice.PARSE_TOOTHBRUSH_DATA(prop.ManufacturerData);

        this.mqttClient.publish("toothbrush/" + this.id + "/presence", parsedData.state > 0 ? "online" : "offline");
        this.mqttClient.publish("toothbrush/" + this.id + "/state", OralBToothbrushDevice.STATES[parsedData.state]);
        this.mqttClient.publish("toothbrush/" + this.id + "/attributes", JSON.stringify({
            rssi: prop.RSSI,
            pressure: parsedData.pressure,
            time: parsedData.time,
            mode: OralBToothbrushDevice.MODES[parsedData.mode],
            sector: OralBToothbrushDevice.SECTORS[parsedData.sector]
        }));
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
    0: "Unknown",
    1: "Initializing",
    2: "Idle",
    3: "Running",
    4: "Charging",
    5: "Setup",
    6: "Flight Menu",
    113: "Final Test",
    114: "PCB Test",
    115: "Sleeping",
    116: "Transport"
};

OralBToothbrushDevice.MODES = {
    0: "Off",
    1: "Daily Clean",
    2: "Sensitive",
    3: "Massage",
    4: "Whitening",
    5: "Deep Clean",
    6: "Tongue Cleaning",
    7: "Turbo",
    255: "Unknown"
};

OralBToothbrushDevice.SECTORS = {
    0: "Sector 1",
    1: "Sector 2",
    2: "Sector 3",
    3: "Sector 4",
    4: "Sector 5",
    5: "Sector 6",
    7: "Sector 7",
    8: "Sector 8",
    254: "Last sector",
    255: "No sector"
};

module.exports = OralBToothbrushDevice;