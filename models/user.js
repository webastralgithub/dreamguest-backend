const Sequelize = require('sequelize');
const sequelize = require('../util/database');
const bcrypt = require('bcrypt');
const { encrypt, decrypt } = require('../util/crypto-utils');
require('dotenv').config();
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
    // validate: {
    //   is: /^[a-zA-Z\s]*$/,
    //   notEmpty: true
    // },
    get() {
      const value = this.getDataValue('firstName');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('firstName', encrypt(value));
    }
  },
  lastName: {
    type: Sequelize.STRING,
    allowNull: false,
    // validate: {
    //   is: /^[a-zA-Z\s]*$/,
    //   notEmpty: true
    // },
    get() {
      const value = this.getDataValue('lastName');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('lastName', encrypt(value));
    }
  },
  username: {
    type: Sequelize.STRING,
    allowNull: true,
    get() {
      const value = this.getDataValue('username');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('username', encrypt(value));
    }
  },
  unique_code: {
    type: Sequelize.STRING,
    allowNull: true,
    get() {
      const value = this.getDataValue('unique_code');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('unique_code', encrypt(value));
    }
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    // validate: {
    //   isEmail: true, 
    //   notEmpty: true
    // },
    get() {
      const value = this.getDataValue('email');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('email', encrypt(value));
    }
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  mobile: {
    type: Sequelize.STRING,
    allowNull: true,
    get() {
      const value = this.getDataValue('mobile');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('mobile', encrypt(value));
    }
  },
  address: {
    type: Sequelize.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('address');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('address', encrypt(value));
    }
  },
  gender: {
    type: Sequelize.STRING,
    allowNull: true,
    get() {
      const value = this.getDataValue('gender');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('gender', encrypt(value));
    }
  },
  avatar: {
    type: Sequelize.STRING,
    allowNull: true,
    get() {
      const value = this.getDataValue('avatar');
      return value ? decrypt(value) : value;
    },
    set(value) {
      this.setDataValue('avatar', encrypt(value));
    }
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
