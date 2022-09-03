const MqttHandler = require("../../MqttHandler");
const Types = require("./Types");

class GlanceClockMqttHandler extends MqttHandler {
    constructor(options) {
        super(options);

        this.registerTopicHandler("notify", cmd => {
            return this.handleNotifyMessage(cmd);
        });
        this.registerTopicHandler("setBrightness", cmd => {
            return this.handleSetBrightnessMessage(cmd);
        });
        this.registerTopicHandler("saveForecastScene", cmd => {
            return this.handleSaveForecastSceneMessage(cmd);
        });
        this.registerTopicHandler("setTimer", cmd => {
            return this.handleSetTimerMessage(cmd);
        });
        this.registerTopicHandler("stopTimer", cmd => {
            return this.handleStopTimerMessage(cmd);
        });
        this.registerTopicHandler("rawCommand", cmd => {
            return this.handleRawCommandMessage(cmd);
        });

        this.lastState = null;
    }

    updateState(settings) {
        const stringifiedSettings = JSON.stringify(settings);

        if (stringifiedSettings !== this.lastState) {
            this.lastState = stringifiedSettings;
            const state = settings.timeModeEnable ? settings.timeFormat12 ? "12h" : "24h" : "off";
            const brightness = settings.getBrightness(); //TODO: this is shit.

            this.mqttClient.publish(this.writableTopics.state, state, err => {
                if (err) {
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
                if (err) {
                    console.error(err);
                }
            });
        }
    }

    /**
     * @param {object} cmd
     * @param {string} cmd.message
     * @param {string} [cmd.animation]
     * @param {string} [cmd.color]
     * @param {string} [cmd.sound]
     * @param {number} [cmd.repeatCount] //There seems to be a hard limit of.. 80? //TODO
     */
    handleNotifyMessage(cmd) {
        if (typeof cmd === "object") {
            const animation = Types.ENUMS.Animation[cmd.animation];
            const color = Types.ENUMS.Color[cmd.color];
            const sound = Types.ENUMS.Sound[cmd.sound];
            const text = [];

            let repeatCount = cmd.repeatCount !== undefined ? cmd.repeatCount : 1;
            let textData;
            let notice;

            if (repeatCount < 1) {
                repeatCount = 1;
            }

            if (typeof cmd.message === "string") {
                textData = Types.TextData.fromObject({});
                textData.setText(cmd.message);

                for (let i = 1; i <= repeatCount; i++) {
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
                    if (err) {
                        console.error(err);
                    }
                });
            }
        } else {
            console.error({
                msg: "Received invalid command. Not an object",
                cmd: cmd
            });
        }
    }

    /**
     * @param {object} cmd
     * @param {"auto"|number} [cmd.value]
     * @param {object} [cmd.auto]
     * @param {number} [cmd.auto.max]
     * @param {number} [cmd.auto.min]
     */
    handleSetBrightnessMessage(cmd) {
        if (typeof cmd === "object") { //TODO: do this for every handler that expects json
            this.device.getSettings((err, settings) => {
                if (!err) {
                    const brightness = settings.getBrightness();

                    if (cmd.value !== undefined) {
                        brightness.value = cmd.value;
                    }
                    if (cmd.auto && cmd.auto.max !== undefined) {
                        brightness.auto.max = cmd.auto.max;
                    }
                    if (cmd.auto && cmd.auto.min !== undefined) {
                        brightness.auto.min = cmd.auto.min;
                    }

                    try {
                        settings.setBrightness(brightness);
                    } catch (e) {
                        console.error(e);
                    }

                    this.device.setSettings(settings, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });

                } else {
                    console.error(err);
                }
            });
        } else {
            console.error({
                msg: "Received invalid command. Not an object",
                cmd: cmd
            });
        }
    }

    /**
     * @param {object} cmd
     * @param {"ring"|"text"|"both"} cmd.displayMode
     * @param {number} cmd.sceneSlot
     * @param {string} cmd.scene
     * @param {number} cmd.scene.timestamp
     * @param {string} cmd.scene.maxColor
     * @param {string} cmd.scene.minColor
     * @param {number} cmd.scene.max _not_ a float
     * @param {number} cmd.scene.min _not_ a float
     * @param {Array<number>} cmd.scene.template
     * @param {Array<number>} cmd.scene.values exactly 24. _not_ floats
     */
    handleSaveForecastSceneMessage(cmd) {
        if (typeof cmd === "object") {
            const displayMode = GlanceClockMqttHandler.DISPLAY_MODES[cmd.displayMode];

            if (displayMode && typeof cmd.sceneSlot === "number" && cmd.scene) {
                const sceneOptions = {
                    timestamp: cmd.scene.timestamp,
                    maxColor: parseInt(cmd.scene.maxColor.replace("#", "0x")),
                    minColor: parseInt(cmd.scene.minColor.replace("#", "0x")),
                    max: Math.round(cmd.scene.max),
                    min: Math.round(cmd.scene.min),
                    template: cmd.scene.template
                };
                const values = Buffer.alloc(48);

                cmd.scene.values.forEach((val, i) => {
                    if (i < 24) {
                        values.writeInt16LE(val, i * 2);
                    } //drop everything else
                });

                sceneOptions.values = Array.from(values);

                this.device.saveForecastScene({
                    slot: cmd.sceneSlot,
                    mode: displayMode,
                    forecastScene: sceneOptions
                }, err => {
                    if (err) {
                        console.error(err);
                    }
                });
            } else {
                console.error({
                    msg: "Received invalid command",
                    cmd: cmd
                });
            }
        } else {
            console.error({
                msg: "Received invalid command. Not an object",
                cmd: cmd
            });
        }
    }

    /**
     *
     * @param {object} cmd
     * @param {number} [cmd.preTimerCountdown]
     * @param {string} [cmd.text]
     * @param {Array<object>} cmd.intervals
     * @param {number} [cmd.intervals.countdown]
     * @param {number} cmd.intervals.duration in seconds
     */
    handleSetTimerMessage(cmd) {
        if (typeof cmd === "object") {
            const finalText = Types.TextData.fromObject({});
            finalText.setText(typeof cmd.text === "string" ? cmd.text : "Timer expired");

            const intervals = cmd.intervals.map(e => {
                return Types.TimerInterval.fromObject({
                    countdown: typeof e.countdown === "number" ? e.countdown : 0,
                    duration: e.duration
                });
            });



            const timerOptions = {
                countdown: typeof cmd.preTimerCountdown === "number" ? cmd.preTimerCountdown : 0,
                finalText: [finalText],
                intervals: intervals
            };


            this.device.timerSet({
                timer: Types.Timer.fromObject(timerOptions)
            }, err => {
                if (err) {
                    console.error(err);
                }
            });
        } else {
            console.error({
                msg: "Received invalid command. Not an object",
                cmd: cmd
            });
        }
    }

    /**
     *
     * @param {object} cmd
     * @param {string} cmd.action
     */
    handleStopTimerMessage(cmd) {
        if (typeof cmd === "object" && cmd.action === "stop") {
            this.device.timerStop(err => {
                if (err) {
                    console.error(err);
                }
            });
        } else {
            console.error({
                msg: "Received invalid command. Not an object",
                cmd: cmd
            });
        }
    }

    /**
     *
     * @param {object} cmd
     * @param {Array<number>} cmd.op
     * @param {Array<number>} [cmd.payload]
     */
    handleRawCommandMessage(cmd) {
        if (typeof cmd === "object" && Array.isArray(cmd.op) && cmd.op.length > 0) { //TODO: validate
            this.device.executeCommand(cmd.op, cmd.payload, err => {
                if (err) {
                    console.error(err);
                } else {
                    console.info("Executed successfully");
                }
            });
        }
    }
}



GlanceClockMqttHandler.DISPLAY_MODES = {
    "ring": 8,
    "text": 16,
    "both": 24
};

module.exports = GlanceClockMqttHandler;
