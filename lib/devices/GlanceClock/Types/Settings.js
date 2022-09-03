const protobuf = require("protobufjs");
const protoRoot = protobuf.loadSync(require.resolve("./Glance.proto"));

const Settings = protoRoot.lookupType("Settings");

Settings.ctor.prototype.getBrightness = function() {
    const briBuf = Buffer.alloc(4);
    const brightness = {};
    briBuf.writeInt32LE(this.displayBrightness);
    brightness.auto = {
        max: briBuf[1],
        min: briBuf[2]
    };
    brightness.value = briBuf[0] === 0 ? "auto" : briBuf[0];

    return brightness;
};

/**
 *
 * @param {object} options
 * @param {"auto"|number} options.value
 * @param {number} options.auto.max
 * @param {number} options.auto.min
 */
Settings.ctor.prototype.setBrightness = function(options) {
    if (
        (options.value !== "auto" && (options.value > 255 || options.value < 0)) ||
        options.auto.max > 255 || options.auto.max < 0 ||
        options.auto.min > 255 || options.auto.min < 0
    ) {
        throw new Error("Invalid brightness");
    } else {
        const value = options.value === "auto" ? 0 : options.value;

        this.displayBrightness = Buffer.from([
            value,
            options.auto.max,
            options.auto.min,
            0x00
        ]).readInt32LE();
    }
};

module.exports = Settings;
