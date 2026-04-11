const Sequelize = require ('sequelize')
const dotenv = require ('dotenv')
dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL , {
  dialect: 'postgres',
  // dialectOptions : {
  //   ssl : {
  //       require: true,         
  //       rejectUnauthorized: false
  //   },
     
  // } ,
  logging: false, // optional, turn off SQL logging
});
// console.log("🚀 ~ sequelize:", sequelize)


module.exports = {sequelize}