/**
 *
 * @param options {object}
 * @param options.bus
 * @param options.hciDevice {string}
 * @param options.mode {"le"|"bredr"|"auto"}
 * @param options.services {Array<Service>}
 * @param options.devices {Array<Device>}
 * @constructor
 */
const Dongle = function Dongle(options) {
    this.bus = options.bus;
    this.hciDevice = options.hciDevice;
    this.mode = options.mode;
    this.services = options.services;
    this.devices = options.devices;

    this.blueZservice = this.bus.getService('org.bluez');
    this.pathRoot = '/org/bluez/' + this.hciDevice;
};

Dongle.prototype.initialize = function(callback) {
    this.blueZservice.getInterface(this.pathRoot, "org.bluez.Adapter1", (err, adapterInterface) => {
        //https://git.kernel.org/pub/scm/bluetooth/bluez.git/tree/src/adapter.c#n1541
        //To get faster scanning without delays, we need to set at least one filter.
        adapterInterface.SetDiscoveryFilter([["Transport", ["s", this.mode]]], err => {
            if(!err) {
                adapterInterface.StartDiscovery(err => {
                    if(!err) {
                        this.bus.connection.on('message', msg => {
                            this.busMsgHandler(msg);
                        });

                        this.bus.addMatch("type='signal'");

                        callback();
                    } else {
                        callback(err);
                    }
                })
            } else {
                callback(err);
            }
        });
    })
};

Dongle.prototype.busMsgHandler = function(msg) {
    if (
        msg && msg.path && typeof msg.path.indexOf === "function" &&
        msg.path.indexOf(this.pathRoot) === 0
    ) {
        if (Array.isArray(msg.body)) {
            if (msg.body[0] === "org.bluez.Device1") {
                let dev = msg.path.split("/");
                dev = dev[dev.length - 1];

                const props = {};
                if (Array.isArray(msg.body[1])) {
                    msg.body[1].forEach(prop => {
                        if (Array.isArray(prop) && prop.length === 2 && Array.isArray(prop[1])) {
                            const key = prop[0];
                            let val = prop[1][1];

                            if (Array.isArray(val)) {
                                if (key === "ManufacturerData") {
                                    try {
                                        val = val[0][0][1][1][0];
                                    } catch (e) {
                                        console.error(e);
                                    }
                                } else if (key === "ServiceData") {
                                    try {
                                        val = {
                                            UUID: val[0][0][0],
                                            data: val[0][0][1][1][0]
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    }
                                } else if (val.length === 1) {
                                    val = val[0];
                                }

                            }

                            props[key] = val;
                        }
                    })
                } else {
                    console.log("HERE", msg);
                }

                this.devices.forEach(d => {
                    d.handleDbusMessage("org.bluez.Device1", dev, props);
                });
            } else if(msg.body[0] === "org.bluez.GattCharacteristic1") {
                const splitPath = msg.path.split("/");
                const dev = splitPath[4];
                const characteristic = [splitPath[5], splitPath[6]].join("/");

                if(Array.isArray(msg.body[1]) && Array.isArray(msg.body[1][0]) && msg.body[1][0][0] === "Value") {
                    const props = {};
                    const value = msg.body[1][0][1][1][0]; //TODO: Will this break on non-buffer values?

                    props[characteristic] = value;

                    this.devices.forEach(d => {
                        d.handleDbusMessage("org.bluez.GattCharacteristic1", dev, props);
                    });
                }
                //console.log(msg.body[1]);
            } else {
                console.log("THERE", msg);
            }
        } else {
            console.log(msg);
        }
    }
};

module.exports = Dongle;