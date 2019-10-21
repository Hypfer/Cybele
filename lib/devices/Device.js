/**
 *
 * @param options {object}
 * @param options.friendlyName {string}
 * @param options.mac {string}
 * @param options.bus {string}
 * @param options.hciDevice {string}
 * @param options.semaphore {Semaphore}
 * @param options.mqttClient
 * @constructor
 */
const Device = function Device(options) {
    this.friendlyName = options.friendlyName;
    this.mac = options.mac;
    this.macInDbusNotation = this.mac.split(":").map(e => e.toUpperCase()).join("_");

    this.bus = options.bus;
    this.hciDevice = options.hciDevice;
    this.semaphore = options.semaphore;
    this.mqttClient = options.mqttClient;
    this.blueZservice = this.bus.getService('org.bluez');
    this.pathRoot = '/org/bluez/' + this.hciDevice;

    this.id = this.mac.toLowerCase().split(":").join("");
};

Device.prototype.handleDbusMessage = function(type, dev, props) {
    //This might be overwritten by devices
    if(dev === "dev_" + this.macInDbusNotation) {
        switch(type) {
            case "org.bluez.Device1":
                this.handleAdvertisingForDevice(props);
                break;
            case "org.bluez.GattCharacteristic1":
                this.handleNotificationForDevice(props);
                break;
        }

    }
};

/**
 *
 * @param props {object}
 * @param [props.RSSI] {number}
 * @param [props.Name] {string}
 * @param [props.Alias] {string}
 * @param [props.Connected] {bool}
 * @param [props.ServicesResolved] {bool}
 * @param [props.ManufacturerData] {Buffer}
 * @param [props.ServiceData] {object}
 * @param props.ServiceData.UUID {string}
 * @param props.ServiceData.data {Buffer}
 */
Device.prototype.handleAdvertisingForDevice = function(props) {
    //This will be overwritten by devices
};

Device.prototype.handleNotificationForDevice = function(props) {
    //This will be overwritten by devices
};

Device.prototype.handleMqttMessage = function(topic, message) {
    //This will be overwritten by devices
};

Device.prototype.initialize = function(callback) {
    callback();
    //Here, mqtt autodiscovery setup happens
};

module.exports = Device;