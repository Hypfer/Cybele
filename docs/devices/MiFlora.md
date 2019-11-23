# Xiaomi Mi Flora Plant Sensor
![The Device](https://user-images.githubusercontent.com/974410/69484448-b457df00-0e33-11ea-94de-48cefbdffea8.png)

Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

Protocol documentation can be found here: [https://github.com/vrachieru/xiaomi-flower-care-api#protocol](https://github.com/vrachieru/xiaomi-flower-care-api#protocol)


## Device Config Entry
```
{
  "type": "MiFloraDevice",
  "friendlyName": "MiFlora Strawberries",
  "pollingInterval": 600000,
  "mac": "FF:FF:FF:FF:FF:FF"
}
```

## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for state information on the following topics:
`homeassistant/sensor/miflora_ffffffffffff/ffffffffffff_battery/config`
`homeassistant/sensor/miflora_ffffffffffff/ffffffffffff_temperature/config`
`homeassistant/sensor/miflora_ffffffffffff/ffffffffffff_illuminance/config`
`homeassistant/sensor/miflora_ffffffffffff/ffffffffffff_moisture/config`
`homeassistant/sensor/miflora_ffffffffffff/ffffffffffff_conductivity/config`

#### State
`cybele/miflora/ffffffffffff/state` provides the current state as JSON

```
{
    "battery": 21,
    "temperature": 23.7,
    "illuminance": 210,
    "moisture": 17,
    "conductivity": 23
}
```