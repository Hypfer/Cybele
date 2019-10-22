# Generic BLE Device which provides battery information
This module can be used in combination with other modules to add battery information. 
This way, you will know when you need to replace your ble beacons battery.

Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

## Device Config Entry
```
{
  "type": "BatteryPoweredDevice",
  "friendlyName": "Keychain Beacon",
  "mac": "FF:FF:FF:FF:FF:FF",
  "pollingInterval": 300000,
  "disconnectAfterFetch": true,
  "delayAfterConnect": 800
}
```

`pollingInterval` the interval this module will use to fetch battery information in milliseconds

`disconnectAfterFetch` determine if this module should disconnect after fetching battery information
Beacons will usually stop advertising while being connected so not disconnecting might break things

`delayAfterConnect` time to wait for the battery interface to become available before reading in milliseconds


## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for state information on 
`homeassistant/sensor/bat_ffffffffffff/config`

#### State
`battery_powered_ble_device/ffffffffffff/state` provides the current battery percentage
