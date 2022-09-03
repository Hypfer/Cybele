const MqttHandler = require("../../MqttHandler");


class MiKettleMqttHandler extends MqttHandler {
    /**
     * @param {object} options
     */
    constructor(options) {
        super(options);

        this.registerTopicHandler("set_keep_warm_parameters", cmd => {
            return this.setKeepWarmParameters(cmd);
        });
        this.registerTopicHandler("set_keep_warm_time_limit", cmd => {
            return this.setKeepWarmTimeLimit(cmd);
        });
        this.registerTopicHandler("set_keep_warm_refill_mode", cmd => {
            return this.setKeepWarmRefillMode(cmd);
        });

        this.lastState = null;
    }

    setupAutodiscovery(callback) {
        this.device.mqttClient.publish("homeassistant/sensor/kettle_" + this.device.id + "/config", JSON.stringify({
            "state_topic": this.writableTopics.state,
            "json_attributes_topic": this.writableTopics.attributes,
            "name": this.device.friendlyName,
            "unique_id": "cybele_kettle_" + this.device.id,
            "platform": "mqtt",
            "unit_of_measurement": "°C",
            "availability_topic": this.writableTopics.presence,
            "icon": "mdi:kettle"
        }), {retain: true}, callback);
    }

    updateState(state) {
        const stringifiedState = JSON.stringify(state);

        if (stringifiedState !== this.lastState) {
            this.lastState = stringifiedState;

            this.updatePresence(true);
            this.mqttClient.publish(this.writableTopics.state, state.current_temperature.toString(), {retain: true}, err => {
                if (err) {
                    console.error(err);
                }
            });
            this.mqttClient.publish(this.writableTopics.attributes, JSON.stringify({
                action: state.action,
                mode: state.mode,
                keep_warm_refill_mode: state.keep_warm_refill_mode,
                keep_warm_temperature: state.keep_warm_set_temperature,
                keep_warm_type: state.keep_warm_type,
                keep_warm_time: state.keep_warm_time,
                keep_warm_time_limit: state.keep_warm_time_limit
            }), {retain: true}, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }

    /**
     * @param {object} cmd
     * @param {"boil"|"heat"} cmd.mode
     * @param {number} cmd.temperature
     */
    setKeepWarmParameters(cmd) {
        const mode = MiKettleMqttHandler.KEEP_WARM_MODES[cmd.mode];
        const temp = cmd.temperature;

        if (mode !== undefined && temp >= 40 && temp <= 90) {
            this.device.setKeepWarmParameters(mode, temp, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }

    /**
     *
     * @param {object} cmd
     * @param {number} cmd.time
     */
    setKeepWarmTimeLimit(cmd) {
        const time = Math.round(cmd.time * 2);

        if (time >= 0 && time <= 24) {
            this.device.setKeepWarmTimeLimit(time, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }

    /**
     *
     * @param {object} cmd
     * @param {"turn_off"|"keep_warm"} cmd.mode
     */
    setKeepWarmRefillMode(cmd) {
        const mode = MiKettleMqttHandler.KEEP_WARM_REFILL_MODE[cmd.mode];

        if (mode !== undefined) {
            this.device.setKeepWarmRefillMode(mode, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }
}



MiKettleMqttHandler.KEEP_WARM_MODES = {
    "boil": 0,
    "heat": 1
};

MiKettleMqttHandler.KEEP_WARM_REFILL_MODE = {
    "turn_off": 1,
    "keep_warm": 0
};


module.exports = MiKettleMqttHandler;
