const{sequelize} = require("../config/db");
const {DataTypes} = require("sequelize")

const DeviceModel = require("./devices");

const Devices = DeviceModel(sequelize, DataTypes)

module.exports = {
    sequelize,Devices
}