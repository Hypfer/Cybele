# Oral-B Smart Toothbrush
![The Device](https://i.imgur.com/fUGMaZZ.png)
Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

## Device Config Entry
```
{
  "type": "OralBToothbrushDevice",
  "friendlyName": "Series 7000",
  "mac": "FF:FF:FF:FF:FF:FF"
}
```

## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for state information + attributes on 
`homeassistant/sensor/toothbrush_ffffffffffff/config`.

#### Presence
`toothbrush/ffffffffffff/presence` will either be `online` or `offline`

#### State
`toothbrush/ffffffffffff/state` provides the current temperature

may be one of the following:
* `unknown`
* `initializing`
* `idle`
* `running`
* `charging`
* `setup`
* `flight_menu`
* `final_test`
* `pcb_test`
* `sleeping`
* `transport`

#### Attributes
`toothbrush/ffffffffffff/attributes` provides the current attributes.

```
{
    "rssi": -91,
    "pressure": 32,
    "time": 3,
    "mode": "daily_clean",
    "sector": "sector_1"
 }
```
`mode` may be one of the following:
* `off`
* `daily_clean`
* `sensitive`
* `massage`
* `whitening`
* `deep_clean`
* `tongue_cleaning`
* `turbo`
* `unknown`


`sector` may be one of the following:
* `sector_1`
* `sector_2`
* `sector_3`
* `sector_4`
* `sector_5`
* `sector_6`
* `sector_7`
* `sector_8`
* `unknown_1`
* `unknown_2`
* `unknown_3`
* `unknown_4`
* `unknown_5`
* `last_sector`
* `no_sector`