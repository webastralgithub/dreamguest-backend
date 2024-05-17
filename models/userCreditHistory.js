const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const CreditHistory = sequelize.define('CreditHistory', {
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    creditsPurchased: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
});

module.exports = CreditHistory;

