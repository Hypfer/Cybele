const protobuf = require("protobufjs");
const protoRoot = protobuf.loadSync(require.resolve("./Glance.proto"));

const Types = {
    ENUMS: require("./Enums"),
    ENUMS_REVERSE: {},
    Notice: protoRoot.lookupType("Notice"),
    TextData: require("./TextData"),
    Settings: require("./Settings"),
    ForecastScene: require("./ForecastScene"),
    CustomScene: protoRoot.lookupType("CustomScene")
};

Object.keys(Types.ENUMS).forEach(key => {
    const reversed = {};

    Object.keys(Types.ENUMS[key]).forEach(k => {
        reversed[Types.ENUMS[key][k]] = k;
    });

    Types.ENUMS_REVERSE[key] = reversed;
});

module.exports = Types;