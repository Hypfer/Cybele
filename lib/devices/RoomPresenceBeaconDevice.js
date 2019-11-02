const util = require("util");
const Device = require("./Device");

/**
 *
 * @param options
 * @param options.friendlyName {string}
 * @param options.mac {string}
 * @param options.bus {string}
 * @param options.room {string}
 * @constructor
 */
const RoomPresenceBeaconDevice = function BeaconDevice(options) {
    Device.call(this, options);

    this.room = options.room;
};

util.inherits(RoomPresenceBeaconDevice, Device);

RoomPresenceBeaconDevice.prototype.handleAdvertisingForDevice = function(props) {
    Device.prototype.handleAdvertisingForDevice.call(this, props);

    if(props.RSSI) {
        //TODO: for some reason, I'm seeing TxPower values of "10", which doesn't really make sense
        const distance = RoomPresenceBeaconDevice.CALCULATE_DISTANCE(props.RSSI, props.TxPower);

        this.mqttClient.publish("room_presence/" + this.room, JSON.stringify({
            id: this.id,
            name: this.friendlyName,
            rssi: props.RSSI,
            uuid: this.id,
            distance: distance
        }), {}, err => {
            if(err) {
                console.error(err);
            }
        });
    }
};

//Taken from https://github.com/mKeRix/room-assistant
RoomPresenceBeaconDevice.CALCULATE_DISTANCE = function calculateDistance(rssi, txPower) {
    txPower = txPower !== undefined ? txPower: -59;
    if (rssi === 0) {
        return -1.0;
    }

    const ratio = rssi * 1.0 / txPower;
    if (ratio < 1.0) {
        return Math.pow(ratio, 10);
    } else {
        return (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
    }
};

module.exports = RoomPresenceBeaconDevice;