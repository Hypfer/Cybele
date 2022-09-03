const protobuf = require("protobufjs");
const protoRoot = protobuf.loadSync(require.resolve("./Glance.proto"));

module.exports = {
    Animation: protoRoot.lookupEnum("Animation").values,
    Color: protoRoot.lookupEnum("Color").values,
    Sound: protoRoot.lookupEnum("Sound").values,
    Settings_DateFormat: protoRoot.lookupEnum("Settings.DateFormat").values
};
