/**
 * @param options {object}
 * @param options.kettle {MiKettleDevice}
 * @constructor
 */
const MqttHandler = function MqttHandler(options) { //TODO: naming?
    this.kettle = options.kettle;

    this.topics = {
        setKeepWarmParameters: "kettle/" + this.kettle.id + "/set_keep_warm_parameters",
        setKeepWarmTimeLimit: "kettle/" + this.kettle.id + "/set_keep_warm_time_limit",
        setBoilMode: "kettle/" + this.kettle.id + "/set_boil_mode"
    };
    this.lastState = null;
};

MqttHandler.prototype.setupAutodiscovery = function(callback) {
    this.kettle.mqttClient.publish("homeassistant/sensor/kettle_" + this.kettle.id + "/config", JSON.stringify({
        "state_topic": "kettle/" + this.kettle.id + "/state",
        "json_attributes_topic": "kettle/" + this.kettle.id + "/attributes",
        "ID": this.kettle.friendlyName,
        "platform": "mqtt",
        "unit_of_measurement": "°C",
        "availability_topic": "kettle/" + this.kettle.id + "/presence",
        "icon": "mdi:kettle"
    }), {retain: true}, callback);
};

MqttHandler.prototype.updateStateTopic = function(state) {
    const stringifiedState = JSON.stringify(state);

    if(stringifiedState !== this.lastState) {
        this.lastState = stringifiedState;

        this.updatePresence(true);
        this.kettle.mqttClient.publish("kettle/" + this.kettle.id + "/state", state.current_temperature.toString(), err => {
            if(err) {
                console.error(err);
            }
        });
        this.kettle.mqttClient.publish("kettle/" + this.kettle.id + "/attributes", JSON.stringify({
            action: state.action,
            mode: state.mode,
            boil_mode: state.boil_mode,
            keep_warm_temperature: state.keep_warm_set_temperature,
            keep_warm_type: state.keep_warm_type,
            keep_warm_time: state.keep_warm_time,
            keep_warm_time_limit: state.keep_warm_time_limit
        }), err => {
            if(err) {
                console.error(err);
            }
        });
    }
};

MqttHandler.prototype.updatePresence = function(isPresent) {
    const payload = isPresent === true ? "online" : "offline";

    this.kettle.mqttClient.publish("kettle/" + this.kettle.id  + "/presence", payload, {retain: true}, err => {
        if(err) {
            console.error(err);
        }
    });
};

MqttHandler.prototype.handleMessage = function(topic, message) {
    switch(topic) {
        case this.topics.setKeepWarmParameters:
                try {
                    this.setKeepWarmParameters(JSON.parse(message));
                } catch (e) {
                    console.error(e);
                }
            break;
        case this.topics.setKeepWarmTimeLimit:
            try {
                this.setKeepWarmTimeLimit(JSON.parse(message));
            } catch (e) {
                console.error(e);
            }
            break;
        case this.topics.setBoilMode:
            try {
                this.setBoilMode(JSON.parse(message));
            } catch (e) {
                console.error(e);
            }
            break;
    }
};

/**
 * @param cmd {object}
 * @param cmd.mode {"boil"|"heat"}
 * @param cmd.temperature {number}
 */
MqttHandler.prototype.setKeepWarmParameters = function(cmd) {
    const mode = MqttHandler.KEEP_WARM_MODES[cmd.mode];
    const temp = cmd.temperature;

    if(mode !== undefined && temp >= 40 && temp <= 95) {
        this.kettle.setKeepWarmParameters(mode, temp, err => {
            if(err) {
                console.error(err);
            }
        });
    }
};

/**
 *
 * @param cmd {object}
 * @param cmd.time {number}
 */
MqttHandler.prototype.setKeepWarmTimeLimit = function(cmd) {
    const time = Math.round(cmd.time * 2);

    if(time >= 0 && time <= 24) {
        this.kettle.setKeepWarmTimeLimit(time, err => {
            if(err) {
                console.error(err);
            }
        })
    }
};

/**
 *
 * @param cmd {object}
 * @param cmd.mode {"turn_off"|"keep_warm"}
 */
MqttHandler.prototype.setBoilMode = function(cmd) {
    const mode = MqttHandler.BOIL_MODES[cmd.mode];

    if(mode !== undefined) {
        this.kettle.setBoilMode(mode, err => {
            if(err) {
                console.error(err);
            }
        })
    }
};

MqttHandler.KEEP_WARM_MODES = {
    "boil": 0,
    "heat": 1
};

MqttHandler.BOIL_MODES = {
    "turn_off": 1,
    "keep_warm": 0
};


module.exports = MqttHandler;