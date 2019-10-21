const protobuf = require("protobufjs");
const protoRoot = protobuf.loadSync(require.resolve("./Glance.proto"));

const TextData = protoRoot.lookupType("TextData");

TextData.ICONS = {
    HOUSE: 128,
    PHONE: 129,
    CLOCK: 130,
    PLUG: 131,
    SMARTPHONE: 132,
    SUN: 133,
    SMILEY: 134,
    WHITE_BLOB: 135,
    NOTHING: 136,
    ZERO_BATTERY: 137,
    ONE_BATTERY: 138,
    TWO_BATTERY: 139,
    THREE_BATTERY: 140,
    NOTIFICATION_MUTE: 141,
    MUTE: 142,
    THERMOMETER: 143,
    DROPLET: 144,
    HEART: 145,
    BAROMETER: 146,
    LOWER_BORDER: 147,
    UPPER_BORDER: 148,
    UMBRELLA: 149,
    BELL: 150,
    SPEAKER: 151,
    WIND_SPEED: 152,
    CLOUD: 153,
    DEGREE: 176,
    TEMPLATE_ICON_REPLACEMENT_CHARACTER: 194
};


Object.keys(TextData.ICONS).forEach(key => {
    TextData.ICONS[key] = Buffer.from([TextData.ICONS[key]]);
});

TextData.TEXT_TO_BUFFER = function(text) {
    const chunks = text.split(/(\${[A-Z_]+})/g);
    const outputChunks = [];

    chunks.forEach(c => {
        const match = c.match(/^\${([A-Z_]+)}$/);

        if(match && match[1]) {
            outputChunks.push(TextData.ICONS[match[1]]);
        } else {
            outputChunks.push(Buffer.from(c, "ascii"))
        }
    });

    return Buffer.concat(outputChunks);
};

TextData.ctor.prototype.setText = function(text) {
    this.text = TextData.TEXT_TO_BUFFER(text);
};




module.exports = TextData;