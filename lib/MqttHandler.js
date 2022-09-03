class MqttHandler {
    /**
     * @param {object} options
     * @param {Device} options.device
     * @param {string} options.prefix
     * @constructor
     */
    constructor(options) {
        this.device = options.device;
        this.prefix = options.prefix;

        this.mqttClient = this.device.mqttClient;

        this.writableTopics = {
            state: "cybele/" + this.prefix + "/" + this.device.id + "/state",
            attributes: "cybele/" + this.prefix + "/" + this.device.id + "/attributes",
            presence: "cybele/" + this.prefix + "/" + this.device.id + "/presence"
        };

        this.topicHandlers = {};
        this.topics = [];
    }

    registerTopicHandler(suffix, handler) {
        const topic = this.getTopicHandlerTopic(suffix);

        this.topicHandlers[topic] = handler;
        this.topics = Object.keys(this.topicHandlers);
    }

    getTopicHandlerTopic(suffix) {
        return "cybele/" + this.prefix + "/" + this.device.id + "/" + suffix;
    }

    initialize(callback) {
        this.setupAutodiscovery(err => {
            if (!err) {
                if (Array.isArray(this.topics) && this.topics.length > 0) {
                    this.mqttClient.subscribe(this.topics, {}, callback);
                } else {
                    callback();
                }
            } else {
                callback(err);
            }
        });
    }

    handleMessage(topic, message) {
        if (this.topics.includes(topic)) {
            try {
                const parsedMessage = JSON.parse(message);
                this.topicHandlers[topic](parsedMessage);
            } catch (e) {
                this.topicHandlers[topic](message);
            }
        }
    }

    setupAutodiscovery(callback) {
        callback();
    }

    updatePresence(isPresent) {
        const payload = isPresent === true ? "online" : "offline";

        this.device.mqttClient.publish(this.writableTopics.presence, payload, {retain: true}, err => {
            if (err) {
                console.error(err);
            }
        });
    }
}


module.exports = MqttHandler;
