const MqttHandler = require("../../MqttHandler");

class EqivaThermostatMqttHandler extends MqttHandler {
    /**
     * @param {object} options
     */
    constructor(options) {
        super(options);

        this.registerTopicHandler("set_temperature", cmd => {
            return this.setTemperature(cmd);
        });
        this.registerTopicHandler("set_mode", cmd => {
            return this.setMode(cmd);
        });

        this.lastState = null;
    }

    setupAutodiscovery(callback) {
        this.device.mqttClient.publish("homeassistant/climate/" + this.prefix + "_" + this.device.id + "/config", JSON.stringify({
            "json_attributes_topic": this.writableTopics.attributes,
            "name": this.device.friendlyName,
            "unique_id": "cybele_eqiva_thermostat_" + this.device.id,
            "platform": "mqtt",

            "precision": 0.5,
            "modes": ["auto", "heat"],
            "min_temp": 4.5,
            "max_temp": 30,
            "temp_step": 0.5,

            "current_temperature_topic": this.writableTopics.state, //todo: this is bogus
            "current_temperature_template": "{{ value_json.temperature }}",

            "temperature_command_topic": this.getTopicHandlerTopic("set_temperature"),
            "temperature_state_topic": this.writableTopics.state,
            "temperature_state_template": "{{ value_json.temperature }}",

            "mode_state_topic": this.writableTopics.state,
            "mode_state_template": "{{ value_json.mode }}",
            "mode_command_topic": this.getTopicHandlerTopic("set_mode")
        }), {retain: true}, callback);
    }

    updateState(state) {
        const stringifiedState = JSON.stringify(state);

        if (stringifiedState !== this.lastState) {
            this.lastState = stringifiedState;

            this.mqttClient.publish(this.writableTopics.state, JSON.stringify({
                temperature: state.temperature,
                mode: EqivaThermostatMqttHandler.GET_HA_MODE_FROM_STATE(state.mode)
            }), {retain: true}, err => {
                if (err) {
                    console.error(err);
                }
            });
            this.mqttClient.publish(this.writableTopics.attributes, JSON.stringify({
                valve: state.valve,
                mode: state.mode,
                vacation: state.vacation,
                boost: state.boost,
                dst: state.dst,
                window_open: state.window_open,
                locked: state.locked,
                low_bat: state.low_bat
            }), {retain: true}, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }

    /**
     * @param {number} temperature
     */
    setTemperature(temperature) {
        if (temperature >= 4.5 && temperature <= 30) {
            this.device.sendTargetTemperatureCommand(temperature, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }

    /**
     *
     * @param {"auto"|"heat"} mode
     */
    setMode(mode) {
        if (mode === "auto" || mode === "heat") {
            const eqivaMode = mode === "heat" ? "manual" : mode;

            this.device.sendModeCommand(eqivaMode, err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    }
}

EqivaThermostatMqttHandler.GET_HA_MODE_FROM_STATE = function(state) {
    if (state.mode === "auto") {
        return "auto";
    } else {
        if (state.temperature <= 4.5) {
            return "off";
        } else {
            return "heat";
        }
    }
};

module.exports = EqivaThermostatMqttHandler;
