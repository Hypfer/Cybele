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
  "mac": "FF:FF:FF:FF:FF:FF"
}
```

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