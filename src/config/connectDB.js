const {sequelize} = require('./db')

 const connectDB = async () => {
    try {
        await sequelize.authenticate();
            await sequelize.sync({force:true});
        console.log('Database connected')
    } catch (error) {
        console.log("🚀 ~ connectDB ~ error:", error)
        throw error
        
    }
};

module.exports = {connectDB}
