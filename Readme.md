# Cybele

Cybele is a generic and extensible application used to bridge Bluetooth Low Energy devices to MQTT.

It is written in Javascript and utilizes the BlueZ Linux Bluetooth stack via its D-Bus interface.

## Features
Cybele can..
* Connect to a multitude of devices
* Use multiple HCI Dongles to work around hardware limitations
* Run own GATT Services

## Supported devices
Currently, the following devices/device types are supported:

* GlanceClock Smart Wall Clock
* [Xiaomi Mi Mija Smart Kettle](docs/devices/MiSmartKettle.md)
* [Xiaomi Mi Body Composition Scale](docs/devices/MiBodyCompositionScale.md)
* [Oral-B Smart Toothbrushes](docs/devices/OralBToothbrush.md)
* [Room Presence tracking using generic BLE Beacons](docs/devices/RoomPresenceBeacon.md)
* [Generic BLE Devices which provide battery information](docs/devices/BatteryPoweredDevice.md)
* [Xiaomi Mi Flora Plant Sensors](docs/devices/MiFlora.md)
* [eQ-3 Eqiva BLUETOOTH® Radiator Thermostats](docs/devices/EqivaThermostat.md)

_You can click on the device to jump to its documentation._

## Requirements
Since Cybele uses BlueZ, you will need some GNU+Linux distribution.

You will also need a recent version of nodejs. Development was done using Node 11.

The BlueZ Version needs to be rather new as well. Debian Busters BlueZ 5.50 is sufficient.

## Deployment
Deployment is simple:
1. Clone this repo
2. Navigate into the cloned repo and run `npm install`
3. Copy `config.default.json` to `config.json` and edit according to your needs. Documentation can be found [here.](docs/index.md)
4. Run `app.js`. Either manually using `node app.js` or by using the provided systemd unit file.

A sample systemd unit file is included [here.](deployment/systemd/cybele.service)

Place it in `/etc/systemd/system/` and don't forget to change the paths in it if required.

## Misc
Please note that Cybele is currently in its early stages.
There is still a lot to do regarding both error handling as well as code-cleanup.

##### GATT Services
To run own GATT services, you also need permission to bring up a service on the system D-Bus.

A sample configuration which grants these rights to a user named `pi` is included [here.](deployment/dbus/cybele.conf)

Just place that file in `/etc/dbus-1/system.d` and you should be able to use the included `CurrentTimeService`.

##### Why the name?
No particular reason. I just needed something less generic than `ble2mqtt` or `bleGateway`.

It also fits nicely with [Valetudo](https://github.com/Hypfer/Valetudo)