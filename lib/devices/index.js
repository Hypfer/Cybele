const device_by_type = {};
const Devices = {
    RoomPresenceBeaconDevice: require("./RoomPresenceBeaconDevice"),
    BatteryPoweredDevice: require("./BatteryPoweredDevice"),
    GlanceClockDevice: require("./GlanceClock/GlanceClockDevice"),
    OralBToothbrushDevice: require("./OralBToothbrushDevice"),
    MiBodyScaleDevice: require("./BodyScale/MiBodyScaleDevice"),
    MiKettleDevice: require("./MiKettle/MiKettleDevice")
};

Object.keys(Devices).forEach(key => {
    device_by_type[key] = Devices[key];
});

Devices.DEVICE_BY_TYPE = device_by_type;
Devices.Device = require("./Device");

module.exports = Devices;