const Sequelize = require('sequelize');

const sequelize = new Sequelize('loyalty_database', 'root', 'redhat', {
  dialect: 'mysql',
  host: 'localhost'
});

module.exports = sequelize;
