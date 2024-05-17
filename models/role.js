const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const Role = sequelize.define('role', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      is: /^[a-zA-Z\s]*$/,
      notEmpty: true
    }
  },
 
});

module.exports = Role;

