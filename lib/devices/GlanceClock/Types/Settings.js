const protobuf = require("protobufjs");
const protoRoot = protobuf.loadSync(require.resolve("./Glance.proto"));

const Settings = protoRoot.lookupType("Settings");

Settings.ctor.prototype.getBrightness = function() {
    const briBuf = Buffer.alloc(4);
    const brightness = {};
    briBuf.writeInt32LE(this.displayBrightness);
    brightness.auto = {
        enabled: briBuf[0] === 0,
        max: briBuf[1],
        min: briBuf[2]
    };
    brightness.value = briBuf[0];

    return brightness;
};

/**
 *
 * @param options {object}
 * @param options.value {number}
 * @param options.auto {object}
 * @param options.auto.enabled {bool}
 * @param options.auto.max {number}
 * @param options.auto.min {number}
 */
Settings.ctor.prototype.setBrightness = function(options) {
    if(
        options.value > 255 || options.value < 0 ||
        options.auto.max > 255 || options.auto.max < 0 ||
        options.auto.min > 255 || options.auto.min < 0
    ) {
        throw new Error("Invalid brightness");
    } else {
        if(options.auto.enabled === true && options.value !== 0) {
            options.value = 0;
        }
        this.displayBrightness = Buffer.from([
            options.value,
            options.auto.max,
            options.auto.min,
            0x00
        ]).readInt32LE();
    }
};

module.exports = Settings;