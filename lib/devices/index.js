const device_by_type = {};
const Devices = {
    BatteryPoweredDevice: require("./BatteryPoweredDevice"),
    EqivaThermostatDevice: require("./EqivaThermostat/EqivaThermostatDevice"),
    GlanceClockDevice: require("./GlanceClock/GlanceClockDevice"),
    MiBodyScaleDevice: require("./BodyScale/MiBodyScaleDevice"),
    MiFloraDevice: require("./MiFloraDevice"),
    MiKettleDevice: require("./MiKettle/MiKettleDevice"),
    MiLYWSD03MMCDevice: require("./MiLYWSD03MMCDevice"),
    OralBToothbrushDevice: require("./OralBToothbrushDevice"),
    RoomPresenceBeaconDevice: require("./RoomPresenceBeaconDevice")
};

Object.keys(Devices).forEach(key => {
    device_by_type[key] = Devices[key];
});

Devices.DEVICE_BY_TYPE = device_by_type;
Devices.Device = require("./Device");

module.exports = Devices;
