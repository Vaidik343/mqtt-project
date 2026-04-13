const logger = require("../utils/logger");
const {DeviceLogs} = require("../models")

const logDeviceEvent = async ({deviceId, event, message, meta = {}}) => {
    try {
        // 1. winston log
        logger.info({
            deviceId,
            event,
            message,
            ...meta                   
        });

        //2. DB log
        await DeviceLogs.create({
              device_id: deviceId,
              event, 
              message,
              meta  
        });
    } catch (error) {
        logger.error("Log service error", {error: error.message});
    }

}

module.exports = {logDeviceEvent};