const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {

    const Devices = sequelize.define(
        'Devices', {
            id:{
                type:DataTypes.UUID,
                defaultValue: () => uuidv4(),  
                primaryKey: true,
                allowNull:false 
            },
            device_id: {
                type:DataTypes.STRING,
                allowNull:false
            },
status: {
    type: DataTypes.ENUM("online", "offline"),
    defaultValue: "offline",
    allowNull: false
},
            last_seen: {
                type:DataTypes.DATE
            },
        },
            {
      tableName: "devices",
      timestamps: true,
    }
    )

    return Devices

}