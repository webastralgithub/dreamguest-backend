const Sequelize = require('sequelize');
const sequelize = require('../util/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('user', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  firstName: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      is: /^[a-zA-Z\s]*$/,
      notEmpty: true
    }
  },
  lastName: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      is: /^[a-zA-Z\s]*$/,
      notEmpty: true
    }
  },
  username: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true, 
    validate: {
      isEmail: true, 
      notEmpty: true
    }
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  mobile: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  gender: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  avatar: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  verifyuserOTP: Sequelize.INTEGER,
  otpExpiry: Sequelize.DATE,
  resetPasswordToken: Sequelize.STRING,
  resetPasswordExpires: Sequelize.DATE,
  failedLoginAttempts: {
    type: Sequelize.INTEGER,
    defaultValue: 0
  },
  lastFailedLoginAttemptAt: {
    type: Sequelize.DATE
  },
  userCredits: {
    type: Sequelize.INTEGER,
    defaultValue: 0
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        user.password = hashedPassword;
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        user.password = hashedPassword;
      }
    }
  }
});

module.exports = User;

