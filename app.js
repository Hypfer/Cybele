const dbus = require('dbus-native');
const async = require("async");
const mqtt = require("mqtt");

const DongleFactory = require("./lib/DongleFactory");

const config = require("./config.json");
const bus = dbus.systemBus();

const mqttClient = mqtt.connect(config.mqtt.url, {});

//TODO: validate config file

mqttClient.on("connect", () => {
    const dongles = [];
    console.info("Connected to MQTT Broker");

    const dongleFactory = new DongleFactory({
        bus: bus,
        mqttClient: mqttClient
    });

    async.each(config.dongles, (dongleConfig, done) => {
        dongleFactory.manufacture(dongleConfig, (err, dongle) => {
            if(!err) {
                dongles.push(dongle);
            }

            done(err);
        })
    }, err => {
        if(!err) {
            console.log("Startup complete");

           mqttClient.on("message", (topic, message) => {
               message = message.toString();

               dongles.forEach(dongle => {
                   dongle.devices.forEach(device => {
                       device.handleMqttMessage(topic, message);
                   })
               })
           });
        } else {
            console.error(err);
            process.exit(0);
        }
    });
});

["error", "close", "disconnect", "end"].forEach(event => {
    //TODO: Something reasonable
    mqttClient.on(event, (e) => {
        console.error(e);
        process.exit(0);
    })
});