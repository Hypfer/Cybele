# Generic Room Presence BLE Beacon
This module shall be used with [https://www.home-assistant.io/integrations/mqtt_room/](https://www.home-assistant.io/integrations/mqtt_room/)

Please replace `FF:FF:FF:FF:FF:FF` as well as `ffffffffffff` with your devices mac.

## Device Config Entry
```
{
  "type": "RoomPresenceBeaconDevice",
  "friendlyName": "Keychain Beacon",
  "mac": "FF:FF:FF:FF:FF:FF",
  "room": "living_room"
}
```

## MQTT

#### Autoconfig
Sadly, the `mqtt_room` component doesn't allow mqtt auto configuration (yet?)

#### Presence
When an advertisement is received, this device module will calculate the approximate distance and publish it to
`room_presence/room` where `room` is the room you've chosen in the Device Config Entry section

The payload will look like this: 
```
{
    "id": "ffffffffffff",
    "name": "Keychain Beacon",
    "rssi": -81,
    "uuid": "ffffffffffff",
    "distance": 10.467388920465797
}
```