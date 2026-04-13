const{sequelize} = require("../config/db");
const {DataTypes} = require("sequelize")

const DeviceModel = require("./devices");
const DeviceLogsModel = require("./deviceLogs");

const Devices = DeviceModel(sequelize, DataTypes)
const DeviceLogs = DeviceLogsModel(sequelize, DataTypes)

module.exports = {
    sequelize,Devices, DeviceLogs
}