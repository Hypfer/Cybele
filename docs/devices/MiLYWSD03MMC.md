# Xiaomi Mijia LYWSD03MMC Bluetooth 4.2 Temperature Humidity sensor
![The Device](https://community-assets.home-assistant.io/original/3X/6/1/61b3a37f1b2c54dbf9fae66f0fd8484e301fdfeb.png)

First, upgrade your devices with custom firmware described here: https://github.com/atc1441/ATC_MiThermometer

Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

## Device Config Entry
```
{
  "type": "MiLYWSD03MMCDevice",
  "friendlyName": "Bedroom temperature sensor",
  "mac": "FF:FF:FF:FF:FF:FF"
}
```

## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for state information on the following topics:
`homeassistant/sensor/MiLYWSD03MMC/ffffffffffff_tem/config`
`homeassistant/sensor/MiLYWSD03MMC/ffffffffffff_hum/config`
`homeassistant/sensor/MiLYWSD03MMC/ffffffffffff_bat/config`
`homeassistant/sensor/MiLYWSD03MMC/ffffffffffff_batv/config`

#### State
`cybele/MijiaLYWSD03MMC/ffffffffffff/state` provides the current state as JSON

```
{
  "tempc": 21.8,
  "hum": 49,
  "batt": 73,
  "volt": 2.863
}
```