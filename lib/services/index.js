const service_by_type = {};
const Services = {
    CurrentTimeService: require("./CurrentTimeService")
};

Object.keys(Services).forEach(key => {
    service_by_type[key] = Services[key];
});

Services.SERVICE_BY_TYPE = service_by_type;
Services.Service = require("./Service");

module.exports = Services;
