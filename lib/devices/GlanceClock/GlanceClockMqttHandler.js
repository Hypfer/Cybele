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
    this.registerTopicHandler("setBrightness", cmd => this.handleSetBrightnessMessage(cmd));
    this.registerTopicHandler("rawCommand", cmd => this.handleRawCommandMessage(cmd));

    this.lastState = null;
};

util.inherits(GlanceClockMqttHandler, MqttHandler);

GlanceClockMqttHandler.prototype.updateState = function(settings) {
    const stringifiedSettings = JSON.stringify(settings);

    if(stringifiedSettings !== this.lastState) {
        this.lastState = stringifiedSettings;
        const state = settings.timeModeEnable ? settings.timeFormat12 ? "12h" : "24h" : "off";
        const brightness = settings.getBrightness(); //TODO: this is shit.

        this.mqttClient.publish(this.writableTopics.state, state, err => {
            if(err) {
                console.error(err);
            }
        });

        this.mqttClient.publish(this.writableTopics.attributes, JSON.stringify({
            dateFormat: Types.ENUMS_REVERSE.Settings_DateFormat[settings.dateFormat],
            automaticNightMode: settings.nightModeEnabled,
            pointsEnabled: settings.pointsAlwaysEnabled,
            brightness: brightness.value,
            auto_brightness_max: brightness.auto.max,
            auto_brightness_min: brightness.auto.min
        }), err => {
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
 * @param [cmd.repeatCount] {number} //There seems to be a hard limit of.. 80? //TODO
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

    if(typeof cmd.message === "string") {
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

        this.device.notify({
            notice: notice
        }, err => {
            if(err) {
                console.error(err);
            }
        })
    }
};

/**
 * @param cmd {object}
 * @param [cmd.value] {"auto"|number}
 * @param [cmd.auto] {object}
 * @param [cmd.auto.max] {number}
 * @param [cmd.auto.min] {number}
 */
GlanceClockMqttHandler.prototype.handleSetBrightnessMessage = function(cmd) {
    this.device.getSettings((err, settings) => {
        if(!err) {
            const brightness = settings.getBrightness();

            if(cmd.value !== undefined) {
                brightness.value = cmd.value;
            }
            if(cmd.auto && cmd.auto.max !== undefined) {
                brightness.auto.max = cmd.auto.max;
            }
            if(cmd.auto && cmd.auto.min !== undefined) {
                brightness.auto.min = cmd.auto.min;
            }

            try {
                settings.setBrightness(brightness)
            } catch(e) {
                console.error(e);
            }

            this.device.setSettings(settings, (err) => {
                if(err) {
                    console.error(err);
                }
            })

        } else {
            console.error(err);
        }
    })
};

/**
 *
 * @param cmd {object}
 * @param cmd.op {Array<number>}
 * @param [cmd.payload] {Array<number>}
 */
GlanceClockMqttHandler.prototype.handleRawCommandMessage = function(cmd) {
    if(Array.isArray(cmd.op) && cmd.op.length > 0) { //TODO: validate
        this.device.executeCommand(cmd.op, cmd.payload, err => {
            if(err) {
                console.error(err);
            } else {
                console.info("Executed successfully");
            }
        });
    }
};

module.exports = GlanceClockMqttHandler;