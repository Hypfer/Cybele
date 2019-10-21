const protobuf = require("protobufjs");
const protoRoot = protobuf.loadSync(require.resolve("./Glance.proto"));

const ForecastScene = protoRoot.lookupType("ForecastScene");

/**
 *
 * @param data {Array<number>}
 */
ForecastScene.ctor.prototype.setForecastData = function(data) { //TODO
    let max;
    let min;

    if(data.length > 24) {
        throw new Error("Too much data")
    }

    this.values = Buffer.alloc(48);

    data.forEach((d,i) => {
        if(d > max || max === undefined) {
            max = d;
        }
        if(d < min || min === undefined) {
            min = d;
        }
        this.values.writeInt16LE(d, i*2)
    });

    this.min = min;
    this.max = max;
};

ForecastScene.ctor.prototype.setTimestamp = function(date) {
    this.timestamp = Math.floor(date.getTime()/1000) - (date.getTimezoneOffset() * 60)
};

ForecastScene.MODE = {
    RING: 8,
    TEXT: 16,
    BOTH: 24
};

module.exports = ForecastScene;