# Cybele


## Hardware recommendations
Due to reliability issues caused by unstable bluetooth adapter firmwares,
it is recommended to only use Broadcom usb Bluetooth Adapters connected to a usb hub supported by [uhubctl](https://github.com/mvp/uhubctl).

This enables Cybele to power-cycle a misbehaving adapter and _hopefully_ get everything back to a working state.

A Raspberry Pi 3B+ for example comes with two uhubctl-supported USB Ports (next to the ethernet jack).
Just don't forget to disable on-board bluetooth.

## General considerations
BLE can and will spam quite a lot:
```
[18893.140515] Bluetooth: hci1: advertising data len corrected
[18893.140534] Bluetooth: hci0: advertising data len corrected
[18894.144542] Bluetooth: hci0: advertising data len corrected
[18894.146531] Bluetooth: hci1: advertising data len corrected
[18895.149522] Bluetooth: hci1: advertising data len corrected
[18895.149562] Bluetooth: hci0: advertising data len corrected
[18896.161532] Bluetooth: hci0: advertising data len corrected
```

While there is no way to suppress these messages from the kernel message buffer, you can at least filter them
from your syslog, which is highly recommended on devices where there is not much storage and the storage available is flash.


If you're using rsyslogd, create a file named `/etc/rsyslog.d/01-blocklist.conf` with the 
following contents and reload/restart the service:
```
:msg,contains,"advertising data len corrected" stop
:msg,contains,"bt_err_ratelimited:" stop
```


## Configuring Cybele

A basic configuration file looks like this
```
{
  "mqtt": {
    "url": "mqtt://user:pass@foobar.example"
  },
  "dongles": [
    {
      "hciDevice": "hci0",
      "mode": "le",
      "troubleshooting": {},
      "services": [],
      "devices": [

      ]
    }
  ]
}
```

#### Devices
Documentation on possible devices can be found [here.](./devices)

#### Troubleshooting
This is an example troubleshooting configuration
```
{
    "scanRestartInterval": 300000,
    "brickWatchdog": {
      "timeout": 60000,
      "recoveryCommand": "/usr/sbin/uhubctl -a 2 -l 1-1.1 -p 2"
    }
}
```

If `scanRestartInterval` is set, Cybele restarts scanning every `scanRestartInterval` milliseconds.
This may or may not combat issues with dongles not scanning anymore.


For issues that can't be fixed by restarting scanning, there is the `brickWatchdog`.
If `brickWatchdog.timeout` milliseconds have passed without any activity from the adapter (no advertisings etc.),
`brickWatchdog.recoveryCommand` gets executed.
In this example, `brickWatchdog.recoveryCommand` will power-cycle the usb port, the corresponding usb bluetooth dongle is connected to.

Cybele will then notice that the adapter has vanished, wait for it to reappear and set-up everything again.

This of course requires a usb bluetooth adapter, a uhubctl-supported usb hub as well as constantly advertising BLE devices nearby, 
since otherwise the timeout will kick in, even though nothing is broken.
