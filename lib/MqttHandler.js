/**
 * @param options {object}
 * @param options.device {Device}
 * @param options.prefix {string}
 * @constructor
 */
const MqttHandler = function MqttHandler(options) {
    this.device = options.device;
    this.prefix = options.prefix;

    this.mqttClient = this.device.mqttClient;

    this.writableTopics = {
        state: this.prefix + "/" + this.device.id + "/state",
        attributes: this.prefix + "/" + this.device.id + "/attributes",
        presence: this.prefix + "/" + this.device.id + "/presence"
    };

    this.topicHandlers = {};
    this.topics = [];
};

MqttHandler.prototype.registerTopicHandler = function(suffix, handler) {
    const topic = this.prefix + "/" + this.device.id + "/" + suffix;
    this.topicHandlers[topic] = handler;
    this.topics = Object.keys(this.topicHandlers);
};


MqttHandler.prototype.initialize = function(callback) {
    this.setupAutodiscovery(err => {
        if(!err) {
            this.mqttClient.subscribe(this.topics, {}, callback);
        } else {
            callback(err);
        }
    })
};

MqttHandler.prototype.handleMessage = function(topic, message) {
    if(this.topics.includes(topic)) {
        try {
            const parsedMessage = JSON.parse(message);
            this.topicHandlers[topic](parsedMessage);
        } catch (e) {
            console.error({message: "Failed to parse mqtt message", error: e});
        }
    }
};

MqttHandler.prototype.setupAutodiscovery = function(callback) {
    callback();
};

MqttHandler.prototype.updatePresence = function(isPresent) {
    const payload = isPresent === true ? "online" : "offline";

    this.device.mqttClient.publish(this.writableTopics.presence, payload, {retain: true}, err => {
        if(err) {
            console.error(err);
        }
    });
};

module.exports = MqttHandler;