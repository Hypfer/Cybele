# Xiaomi Mi Body Composition Scale
![The Device](https://user-images.githubusercontent.com/974410/69484453-bd48b080-0e33-11ea-9360-bc1cca53eca7.png)

Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

## Device Config Entry
```
{
  "type": "MiBodyScaleDevice",
  "friendlyName": "Mi Body Scale",
  "mac": "FF:FF:FF:FF:FF:FF",
  "userSex": "M",
  "userHeight": 180,
  "userBirthday": "1990-01-01T00:00:00.000Z"
}
```
`userSex` may be either `M` or `F`

`userHeight` is the height in centimeters

`userBirthday` will be used for age calculation

## MQTT

#### Autoconfig
The device will attempt to autoconfigure Home Assistant for state information + attributes on 
`homeassistant/sensor/body_scale_ffffffffffff/config`.

#### State
`cybele/body_scale/ffffffffffff/state` provides the weight

#### Attributes
`cybele/body_scale/ffffffffffff/attributes` provides the current attributes.

```
{
    "impedance": 600,
    "lbm": "60.00",
    "bmi": "20.00",
    "fat_pct": "20.00",
    "water_pct": "50.00",
    "bone_mass_kg": "3.00",
    "muscle_mass_kg": "50.00",
    "visceral_fat_mass_kg": "5.00",
    "bmr_kcal": "1800.00",
    "fat": "Normal",
    "water": "Normal",
    "bone_mass": "Normal",
    "muscle_mass": "Normal",
    "visceral_fat": "Normal",
    "bmi_class": "Normal",
    "body_type": "balanced"
}
```
Take a look at [BodyMetrics.js](../../lib/devices/BodyScale/BodyMetrics.js) to find out what these mean.

## Misc
It might make sense to make the BodyMetrics parameters configurable over MQTT instead of hard-coding them in the configuration.