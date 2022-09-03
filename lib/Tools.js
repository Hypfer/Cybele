module.exports = {
    sleep: function(delay) {
        return new Promise(function(resolve, reject) {
            setTimeout(() => {
                resolve();

            }, delay);
        });
    }
};
