const {sequelize} = require('./db')

 const connectDB = async () => {
    try {
        await sequelize.authenticate();
            await sequelize.sync();
        console.log('Database connected')
    } catch (error) {
        console.log("🚀 ~ connectDB ~ error:", error)
        throw error
        
    }
};

module.exports = {connectDB}
