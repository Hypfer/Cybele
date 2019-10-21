# Xiaomi Mi Mija Smart Kettle
Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

Protocol documentation can be found here: [https://github.com/aprosvetova/xiaomi-kettle](https://github.com/aprosvetova/xiaomi-kettle)

## Device Config Entry
```
{
  "type": "MiKettleDevice",
  "friendlyName": "Mi Kettle",
  "mac": "FF:FF:FF:FF:FF:FF",
  "productId": 275
}
```
The correct productId is required for this to work. Yours might be different.

Known values are: 
* 131
* 275

## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for temperature information + attributes on 
`homeassistant/sensor/kettle_ffffffffffff/config`.

#### State
`kettle/ffffffffffff/state` provides the current temperature

#### Attributes
`kettle/ffffffffffff/attributes` provides the current attributes.

```
{
    "action": "idle",
    "mode": "none",
    "boil_mode": "turn_off",
    "keep_warm_temperature": 65,
    "keep_warm_type": "heat_to_temperature",
    "keep_warm_time": 0,
    "keep_warm_time_limit": 12
}
```
`action` may be one of the following:
* `idle`
* `heating`
* `cooling`
* `keeping_warm`

`mode` may be one of the following:
* `none`
* `boil`
* `keep_warm`

`boil_mode` describes what happens after the boiling process is completed.
It may be one of the following:
* `turn_off`
* `keep_warm`

`keep_warm_temperature` is the keep warm temperature in °C (40-95)

`keep_warm_type` may be one of the following:
* `boil_and_cool_down`
* `heat_to_temperature`

`keep_warm_time` is the time in minutes since keep warm was enabled

`keep_warm_time_limit` is the time in hours keep warm will stay on before turning itself off automatically. 0-12.
Half hours are also possible: 7h30m = 7.5

#### Commands

##### Set Keep Warm Parameters
**Topic:** `kettle/ffffffffffff/set_keep_warm_parameters`

**Payload:**
```
{
    "mode": "boil",
    "temperature": 65
}
```
`mode` can either be `boil` or `heat`

`temperature` is the keep warm temperature in °C (40-95)

##### Set Keep Warm Time Limit
**Topic:** `kettle/ffffffffffff/set_keep_warm_time_limit`

**Payload:**
```
{
    "time": 7.5
}
```
`time` is the time in hours keep warm will stay on before turning itself off automatically. 0-12.
Half hours are also possible: 7h30m = 7.5

##### Set Boil Mode
**Topic:** `kettle/ffffffffffff/set_boil_mode`

**Payload:**
```
{
    "mode" : "turn_off"
}
```
`mode` can either be `turn_off` or `keep_warm`
