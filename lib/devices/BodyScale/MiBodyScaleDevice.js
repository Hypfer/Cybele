const Device = require("../Device");

const BodyMetrics = require("./BodyMetrics");

class MiBodyScaleDevice extends Device {
    /**
     *
     * @param {object} options
     * @param {Date} options.userBirthday
     * @param {number} options.userHeight
     * @param {"M"|"F"} options.userSex
     */
    constructor(options) {
        super(options);

        this.userBirthday = new Date(options.userBirthday);
        this.userHeight = options.userHeight;
        this.userSex = options.userSex;

        this.lastStatePublish = new Date(0);
    }

    initialize(callback) {
        this.mqttClient.publish("homeassistant/sensor/body_scale_" + this.id + "/config", JSON.stringify({
            "state_topic": "cybele/body_scale/" + this.id + "/state",
            "json_attributes_topic": "cybele/body_scale/" + this.id + "/attributes",
            "name": this.friendlyName,
            "unique_id": "cybele_body_scale_" + this.id,
            "platform": "mqtt",
            "unit_of_measurement": "kg", //TODO
            "icon": "mdi:scale-bathroom"
        }), {retain: true}, err => {
            callback(err);
        });
    }

    handleAdvertisingForDevice(props) {
        super.handleAdvertisingForDevice(props);
        //TODO: Since this is a generic Body Composition characteristic, it might make sense to extend this class to
        //      support all kinds of standard body composition scales
        if (
            props.ServiceData &&
            props.ServiceData.UUID === "0000181b-0000-1000-8000-00805f9b34fb" &&
            Buffer.isBuffer(props.ServiceData.data)
        ) {
            const parsedData = this.parseServiceData(props.ServiceData.data);

            if (parsedData) {
                const now = new Date();
                if (now.getTime() - 10000 > this.lastStatePublish.getTime()) {
                    this.lastStatePublish = now;

                    this.mqttClient.publish(
                        "cybele/body_scale/" + this.id + "/state",
                        parsedData.weight.toFixed(2),
                        {retain: true}
                    );
                    this.mqttClient.publish(
                        "cybele/body_scale/" + this.id + "/attributes",
                        JSON.stringify(parsedData.attributes),
                        {retain: true}
                    );
                }
            }
        }
    }

    parseServiceData(data) {
        let unit;

        //TODO: Use this value. Handle scales with non-kg-measurements
        if ((data[0] & (1<<4)) !== 0) { // Chinese Catty
            unit = "jin";
        } else if ((data[0] & 0x0F) === 0x03) { // Imperial pound
            unit = "lbs";
        } else if ((data[0] & 0x0F) === 0x02) { // MKS kg
            unit = "kg";
        } else {
            unit = "???";
        }

        const state = {
            isStabilized: ((data[1] & (1 << 5)) !== 0),
            loadRemoved: ((data[1] & (1 << 7)) !== 0),
            impedanceMeasured: ((data[1] & (1 << 1)) !== 0)
        };

        const measurements = {
            weight: (data.readUInt16LE(data.length - 2) / 100) /2,
            impedance: data.readUInt16LE(data.length - 4)
        };

        if (state.isStabilized && state.loadRemoved) {
            //TODO: Maybe don't do the body metrics here at all?
            //By doing those somewhere else, sex, age and height could be completely dynamic
            //At least age is dynamic atm. Just don't grow and/or share your scale, okay?
            const BM = new BodyMetrics({
                age: (new Date().getTime() - this.userBirthday.getTime()) / 31556926000,
                height: this.userHeight,
                sex: this.userSex
            });

            return {
                weight: measurements.weight,
                attributes: Object.assign(
                    {impedance: measurements.impedance},
                    BM.getAllMetrics(measurements.weight, measurements.impedance))
            };
        } else {
            return null;
        }
    }
}

module.exports = MiBodyScaleDevice;
