const Sequelize = require('sequelize');
const sequelize = require('../util/database');

const CustomerHistory = sequelize.define('CustomerHistory', {
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    address: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    crime:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    convictionDate:{
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
    },
    status:{
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    firstName:{
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastName:{
        type: Sequelize.STRING,
        allowNull: false,
    },
    dob:{
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
    },
    city:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    state:{
        type: Sequelize.STRING,
        allowNull: false,
    },
    zipcode:{
        type: Sequelize.STRING,
        allowNull: false,
    },
    sex:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    age:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    eyeColor:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    race:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    weight:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    height:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    hairColor:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    marks:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    riskLevel:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    statute:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    victimAge:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    victimSex:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    registrationDate:{
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
    },
    lat:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    lng:{
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
    },
    offenderUrl:{
        type: Sequelize.TEXT('long'),
        allowNull: true,
        defaultValue: null
    },
    offenderImageUrl:{
        type: Sequelize.TEXT('long'),
        allowNull: true,
        defaultValue: null
    },
    firstNameNickNames:{
        type: Sequelize.TEXT('long'),
        allowNull: true,
        defaultValue: null
    }
});

module.exports = CustomerHistory;
