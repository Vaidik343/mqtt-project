
module.exports = (sequelize, DataTypes) => {
    const DeviceLogs = sequelize.define("DeviceLogs", {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true 
        },
        device_id: {
            type: DataTypes.STRING,
            allowNull: false 
        },
        event: {
            type: DataTypes.STRING 
        },
        message: {
            type: DataTypes.TEXT
        },
        meta: {
            type: DataTypes.JSONB 
        } 

    }, {
        tableName: "device_logs",
        timestamps: true
    }); 

    return DeviceLogs;
}