const protobuf = require("protobufjs");
const protoRoot = protobuf.loadSync(require.resolve("./Glance.proto"));

const Types = {
    CustomScene: protoRoot.lookupType("CustomScene"),
    ENUMS: require("./Enums"),
    ENUMS_REVERSE: {},
    ForecastScene: require("./ForecastScene"),
    Notice: protoRoot.lookupType("Notice"),
    Settings: require("./Settings"),
    TextData: require("./TextData"),
    Timer: protoRoot.lookupType("Timer"),
    TimerInterval: protoRoot.lookupType("Timer.Interval")
};

Object.keys(Types.ENUMS).forEach(key => {
    const reversed = {};

    Object.keys(Types.ENUMS[key]).forEach(k => {
        reversed[Types.ENUMS[key][k]] = k;
    });

    Types.ENUMS_REVERSE[key] = reversed;
});

module.exports = Types;
