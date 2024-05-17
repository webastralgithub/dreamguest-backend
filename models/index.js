const User = require('./user');
const Role = require('./role');

Role.hasMany(User);
User.belongsTo(Role);

module.exports = 
{ 
     Role,
     User,
};
