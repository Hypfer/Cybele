# Xiaomi / Viomi Mi Mija Smart Kettle
![The Device](https://user-images.githubusercontent.com/974410/72007682-7d5a5300-3252-11ea-97a8-74e4c109d231.png)

Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

Protocol documentation can be found here: [https://github.com/aprosvetova/xiaomi-kettle](https://github.com/aprosvetova/xiaomi-kettle)

## Device revisions
There are quite a few revisions of this device

| Name            | Model               | Product ID | Manufacturer Comment            | Notes                             |
|-----------------|---------------------|------------|---------------------------------|-----------------------------------|
| yunmi.kettle.v1 |                     | 131        | Mainland and Hong Kong versions | May have been available in russia |
| yunmi.kettle.v2 | YM-K1501            | 275        | International version           | White, No Display, No Presets(?)  |
| yunmi.kettle.v3 |                     |            | Taiwan version                  |                                   |
| yunmi.kettle.v5 |                     |            | Korean version                  |                                   |
| yunmi.kettle.v6 |                     |            |                                 |                                   |
| yunmi.kettle.v7 | V-SK152A / V-SK152B | 1116       | International version           | Black and White, Display, Presets |

The handle feels a lot more sturdy on the v2 compared to the v7. v7 also seems to have noticeably worse signal strength.

If you don't need the display, you might be better off with an older revision.

## Device Config Entry
```
{
  "type": "MiKettleDevice",
  "friendlyName": "Mi Kettle",
  "mac": "FF:FF:FF:FF:FF:FF",
  "productId": 275
}
```
The correct productId is required for this to work. Check the table above.

Optionally, you can keep using the MiHome app by adding the token extracted from the App to this config entry like this:

```
  "token" : [255,255,255,255,255,255,255,255,255,255,255,255]
```

## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for temperature information + attributes on 
`homeassistant/sensor/kettle_ffffffffffff/config`.

#### Presence
`cybele/kettle/ffffffffffff/presence` will either be `online` or `offline`

You can only send commands when this is `online`

#### State
`cybele/kettle/ffffffffffff/state` provides the current temperature

#### Attributes
`cybele/kettle/ffffffffffff/attributes` provides the current attributes.

```
{
    "action": "idle",
    "mode": "none",
    "keep_warm_refill_mode": "turn_off",
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

`keep_warm_refill_mode` is called `Extended warm up` in the official app.

This defines what happens when the kettle is currently in `keep_warm` mode and gets taken off the dock and put back on again.
If this is set to `keep_warm` >= 45°C and the water temperature hasn't changed by more than 3°C, 
the kettle will return to keeping the water at the set temperature without reboiling it.

If the difference is more than 3°C or this is set to `turn_off` the kettle will just stay off.

It may be one of the following:
* `turn_off`
* `keep_warm`

`keep_warm_temperature` is the keep warm temperature in °C (40-90)

`keep_warm_type` may be one of the following:
* `boil_and_cool_down`
* `heat_to_temperature`

`keep_warm_time` is the time in minutes since keep warm was enabled

`keep_warm_time_limit` is the time in hours keep warm will stay on before turning itself off automatically. 0-12.
Half hours are also possible: 7h30m = 7.5

#### Commands

##### Set Keep Warm Parameters
**Topic:** `cybele/kettle/ffffffffffff/set_keep_warm_parameters`

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
**Topic:** `cybele/kettle/ffffffffffff/set_keep_warm_time_limit`

**Payload:**
```
{
    "time": 7.5
}
```
`time` is the time in hours keep warm will stay on before turning itself off automatically. 0-12.
Half hours are also possible: 7h30m = 7.5

##### Set Keep Warm Refill Mode
**Topic:** `cybele/kettle/ffffffffffff/set_keep_warm_refill_mode`

**Payload:**
```
{
    "mode" : "turn_off"
}
```
`mode` can either be `turn_off` or `keep_warm`
