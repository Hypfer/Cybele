const util = require("util");
const Service = require("./Service");

/**
 *
 * @param options {object}
 * @param options.bus
 * @param options.hciDevice {string}
 * @param [options.serviceName] {string}
 * @constructor
 */
const CurrentTimeService = function CurrentTimeService(options) {
    Service.call(this, options);
    const self = this;

    this.serviceName = options.serviceName || "de.hypfer.cybele";
    this.serviceNameInDBusNotation = "/" + this.serviceName.split(".").join("/");

    this.blueZservice = this.bus.getService('org.bluez');
    this.pathRoot = '/org/bluez/' + this.hciDevice;

    this.bus.exportInterface(
        {
            ReadValue: function (options) {
                const output = Buffer.alloc(10);
                const now = new Date();

                output.writeInt16LE(now.getFullYear());
                output.writeInt8(now.getMonth() + 1, 2);
                output.writeInt8(now.getDate(), 3);
                output.writeInt8(now.getHours(), 4);
                output.writeInt8(now.getMinutes(), 5);
                output.writeInt8(now.getSeconds(), 6);
                output.writeInt8(now.getDay(), 7);
                output.writeInt8(Math.floor(now.getMilliseconds() / 256), 8);

                if (Array.isArray(options) && Array.isArray(options[0]) && options[0][0] === "device" && Array.isArray(options[0][1])) {
                    console.info("Current Time Service request from " + options[0][1][1] + ". Response: " + output.toString("hex"));
                }

                return output;
            },
            Service: this.serviceNameInDBusNotation,
            UUID: "00002A2B-0000-1000-8000-00805f9b34fb",
            Flags: ["read"]
        },
        this.serviceNameInDBusNotation + "/CURRENTTIME",
        {
            name: 'org.bluez.GattCharacteristic1',
            methods: {
                ReadValue: ['', 'ay', [], ['arry{byte}']],
            },
            properties: {
                Service: 'o',
                UUID: 's',
                Flags: 'as'
            },
            signals: {}
        }
    );

    this.bus.exportInterface(
        {
            Primary: true,
            UUID: "00001805-0000-1000-8000-00805f9b34fb"
        },
        this.serviceNameInDBusNotation,
        {
            name: 'org.bluez.GattService1',
            methods: {},
            properties: {
                Primary: 'b',
                UUID: 's'
            },
            signals: {}
        }
    );

    this.bus.exportInterface(
        {
            GetManagedObjects: function () {
                return [ //This is a dict
                    [self.serviceNameInDBusNotation, [["org.bluez.GattService1", [["UUID", ["s", "00001805-0000-1000-8000-00805f9b34fb"]], ["Primary", ["b", true]]]]]],
                    [
                        self.serviceNameInDBusNotation + "/CURRENTTIME",
                        [
                            [
                                "org.bluez.GattCharacteristic1",
                                [
                                    ["UUID", ["s", "00002A2B-0000-1000-8000-00805f9b34fb"]],
                                    ["Service", ["o", self.serviceNameInDBusNotation]],
                                    ["Flags", ["as", ["read"]]]
                                ]
                            ]
                        ]
                    ]
                ]
            }
        },
        self.serviceNameInDBusNotation,
        {
            name: 'org.freedesktop.DBus.ObjectManager',
            methods: {
                GetManagedObjects: ['', 'a{oa{sa{sv}}}', [], ['dict_entry']]
            },
            properties: {},
            signals: {}
        }
    );
};

util.inherits(CurrentTimeService, Service);

CurrentTimeService.prototype.initialize = function(callback) {
    this.bus.requestName(this.serviceName, 0x4, (err, retCode) => {
        err = Array.isArray(err) ? err.join(".") : err;

        if (!err) {
            if (retCode === 1) {
                this.blueZservice.getInterface(this.pathRoot, "org.bluez.GattManager1", (err, gattMgrIface) => {
                    err = Array.isArray(err) ? err.join(".") : err;
                    if(!err && gattMgrIface) {
                        this.gattMgrIface = gattMgrIface;

                        gattMgrIface.RegisterApplication(this.serviceNameInDBusNotation, [], err => {
                            err = Array.isArray(err) ? err.join(".") : err;

                            if(!err) {
                                console.info("Successfully registered CurrentTimeService on " + this.hciDevice)
                            }

                            callback(err);
                        })
                    } else {
                        callback({
                            message: "Failed to fetch org.bluez.GattManager1 for " + this.hciDevice,
                            error: err
                        });
                    }
                })
            } else {
                callback(new Error("Failed with returnCode " + retCode));
            }
        } else {
            callback(err);
        }
    });
};

CurrentTimeService.prototype.destroy = function(callback) {
    this.gattMgrIface.UnregisterApplication(this.serviceNameInDBusNotation, err => {
        err = Array.isArray(err) ? err.join(".") : err;

        if(err) {
            console.error(err); //TODO: handle error
        }

        this.bus.releaseName(this.serviceName, callback);
    })
};

module.exports = CurrentTimeService;