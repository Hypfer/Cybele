# eQ-3 Eqiva BLUETOOTH® Smart Radiator Thermostat
![The Device](https://user-images.githubusercontent.com/974410/70374515-680ca480-18f3-11ea-9312-a103388dadc2.png)

Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

Protocol documentation can be found here: [https://github.com/Heckie75/eQ-3-radiator-thermostat/blob/master/eq-3-radiator-thermostat-api.md](https://github.com/Heckie75/eQ-3-radiator-thermostat/blob/master/eq-3-radiator-thermostat-api.md)


## Device Config Entry
```
{
  "type": "EqivaThermostatDevice",
  "friendlyName": "Eqiva Thermostat Kitchen",
  "pollingInterval": 3600000,
  "pollOnStartup": false,
  "mac": "FF:FF:FF:FF:FF:FF"
}
```

`pollingInterval` the interval this module will use to fetch battery information in milliseconds

If `pollOnStartup` is set to true, the first polling will happen 1s after startup.

## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for temperature information + attributes on 
`homeassistant/climate/eqiva_thermostat_ffffffffffff/config`.

#### State
`cybele/eqiva_thermostat/ffffffffffff/state` provides the current state as JSON

```
{
    "temperature": 22.5,
    "mode": "heat"
}
```

#### Attributes
`cybele/eqiva_thermostat/ffffffffffff/attributes` provides the current attributes as JSON

```
{
    "mode": "manual",
    "vacation": false,
    "boost": false,
    "dst": true,
    "window_open": false,
    "locked": false,
    "low_bat": true
}
```

#### Commands

##### Set Temperature
**Topic:** `cybele/eqiva_thermostat/ffffffffffff/set_temperature`

**Payload:**
```
22.5
```

The requested temperature in °C (4.5-30)

##### Set Mode
**Topic:** `cybele/eqiva_thermostat/ffffffffffff/set_mode`

**Payload:**
```
heat
```
The payload can either be `auto` or `heat`

#### Troubleshooting
For reasons currently unknown, the initial connection to a new thermostat may fail without any feedback.
If this happens, you will see connection timeouts in Cybele.

If you look at the kernel message buffer using `dmesg`, you will also see a _lot_ of messages like this:
```
[  325.988680] Bluetooth: hci0: security requested but not available
```

To fix this issue, stop cybele as well as the bluetooth service, navigate to `/var/lib/bluetooth/[dongle Mac]` and
delete the folder named `[thermostat mac]`.
In this folder, there is a file named `info` which _should_ contain keys which are exchanged/generated on the first connection.

For some reason however, these keys are missing which leads bluetoothd to struggle because that case apparently isn't handled.