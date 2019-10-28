const util = require("util");
const MqttHandler = require("../../MqttHandler");
const Types = require("./Types");

/**
 * @param options {object}
 * @constructor
 */
const GlanceClockMqttHandler = function GlanceClockMqttHandler(options) {
    MqttHandler.call(this, options);

    this.registerTopicHandler("notify", cmd => this.handleNotifyMessage(cmd));

    this.lastState = null;
};

util.inherits(GlanceClockMqttHandler, MqttHandler);

GlanceClockMqttHandler.prototype.updateState = function(settings) {
    settings.brightness = settings.getBrightness(); //TODO: this is shit.
    const stringifiedSettings = JSON.stringify(settings);

    if(stringifiedSettings !== this.lastState) {
        this.lastState = stringifiedSettings;
        const state = settings.timeModeEnable ? settings.timeFormat12 ? "12h" : "24h" : "off";

        this.mqttClient.publish(this.writableTopics.state, state, err => {
            if(err) {
                console.error(err);
            }
        });
        this.mqttClient.publish(this.writableTopics.attributes, stringifiedSettings, err => {
            if(err) {
                console.error(err);
            }
        });
    }
};

/**
 * @param cmd {object}
 * @param cmd.message {string}
 * @param [cmd.animation] {string}
 * @param [cmd.color] {string}
 * @param [cmd.sound] {string}
 * @param [cmd.repeatCount] {number}
 */
GlanceClockMqttHandler.prototype.handleNotifyMessage = function(cmd) {
    const animation = Types.ENUMS.Animation[cmd.animation];
    const color = Types.ENUMS.Color[cmd.color];
    const sound = Types.ENUMS.Sound[cmd.sound];
    const text = [];

    let repeatCount = cmd.repeatCount !== undefined ? cmd.repeatCount : 1;
    let textData;
    let notice;

    if(repeatCount < 1) {
        repeatCount = 1;
    }

    if(cmd.message) {
        textData = Types.TextData.fromObject({});
        textData.setText(cmd.message);

        for(let i = 1; i <= repeatCount; i++) {
            text.push(textData);
        }

        notice = Types.Notice.fromObject({
            text: text,
            type: animation,
            sound: sound,
            color: color
        });

        this.clock.notify({
            notice: notice
        }, err => {
            if(err) {
                console.error(err);
            }
        })
    }
};

module.exports = GlanceClockMqttHandler;