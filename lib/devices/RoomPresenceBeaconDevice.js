const Device = require("./Device");

class RoomPresenceBeaconDevice extends Device {
    /**
     *
     * @param {object} options
     * @param {string} options.friendlyName
     * @param {string} options.mac
     * @param {string} options.bus
     * @param {string} options.room
     */
    constructor(options) {
        super(options);

        this.room = options.room;
    }

    handleAdvertisingForDevice(props) {
        super.handleAdvertisingForDevice(props);
        super.handleAdvertisingForDevice(props);

        if (props.RSSI) {
            //TODO: for some reason, I'm seeing TxPower values of "10", which doesn't really make sense
            const distance = RoomPresenceBeaconDevice.CALCULATE_DISTANCE(props.RSSI, props.TxPower);

            this.mqttClient.publish("room_presence/" + this.room, JSON.stringify({
                id: this.id,
                name: this.friendlyName,
                rssi: props.RSSI,
                uuid: this.id,
                distance: distance
            }), {}, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }
}

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
