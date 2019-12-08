const util = require("util");
const Device = require("./Device");

/**
 *
 * @param options
 * @param options.pollingInterval {number}
 * @param [options.pollOnStartup] {boolean}
 * @constructor
 */
const PollingDevice = function PollingDevice(options) {
    Device.call(this, options);

    this.pollingInterval = options.pollingInterval;
    this.pollOnStartup = options.pollOnStartup === true;

    this.pollTimeout = null;
    this.destroyed = false;
};

util.inherits(PollingDevice, Device);

PollingDevice.prototype.destroy = function (callback) {
    this.destroyed = true;
    clearTimeout(this.pollTimeout);

    callback();
};

PollingDevice.prototype.queuePolling = function () {
    let interval = this.pollingInterval;

    clearTimeout(this.pollTimeout);

    if(this.pollTimeout === null && this.pollOnStartup === true) {
        interval = 1000;
    }

    this.pollTimeout = setTimeout(() => {
        if (this.destroyed === false) {
            this.poll()
        }
    }, interval);
};

PollingDevice.prototype.poll = function () {
    //This will be overwritten by devices
    this.queuePolling();
};

module.exports = PollingDevice;