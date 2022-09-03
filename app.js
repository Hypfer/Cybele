const mqtt = require("mqtt");

const Cybele = require("./lib/Cybele");

const config = require("./config.json");

const mqttClient = mqtt.connect(config.mqtt.url, {});

//TODO: validate config file

mqttClient.on("connect", () => {
    let cybele;
    console.info("Connected to MQTT Broker");

    cybele = new Cybele({
        mqttClient: mqttClient,
        config: config
    });

    cybele.initialize().then(() => {
        console.log("Startup complete");

        mqttClient.on("message", (topic, message) => {
            message = message.toString();

            Object.keys(cybele.dongles).forEach(dongleKey => {
                const dongle = cybele.dongles[dongleKey];

                dongle.devices.forEach(device => {
                    device.handleMqttMessage(topic, message);
                });
            });
        });
    }).catch(err => {
        console.error(err);
        process.exit(0);
    });
});

["error", "close", "disconnect", "end"].forEach(event => {
    //TODO: Something reasonable
    mqttClient.on(event, (e) => {
        console.error(e);
        process.exit(0);
    });
});
