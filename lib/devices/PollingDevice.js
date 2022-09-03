const Device = require("./Device");


class PollingDevice extends Device {
    /**
     *
     * @param {object} options
     * @param {number} options.pollingInterval
     * @param {boolean} [options.pollOnStartup]
     */
    constructor(options) {
        super(options);

        this.pollingInterval = options.pollingInterval;
        this.pollOnStartup = options.pollOnStartup === true;

        this.pollTimeout = null;
        this.destroyed = false;
    }

    destroy(callback) {
        this.destroyed = true;
        clearTimeout(this.pollTimeout);

        callback();
    }

    queuePolling() {
        let interval = this.pollingInterval;

        clearTimeout(this.pollTimeout);

        if (this.pollTimeout === null && this.pollOnStartup === true) {
            interval = 1000;
        }

        this.pollTimeout = setTimeout(() => {
            if (this.destroyed === false) {
                this.poll();
            }
        }, interval);
    }

    poll() {
        //This will be overwritten by devices
        this.queuePolling();
    }
}

module.exports = PollingDevice;
