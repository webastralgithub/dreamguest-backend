const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./util/database');
const User = require('./models/user');
const Role = require('./models/role');
const CreditHistory = require('./models/userCreditHistory');
const CustomerHistory = require('./models/userCustomerHistory');
const cors = require('cors');
require('dotenv').config();

const app = express();

//const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/public/avatars',express.static(__dirname + '/public/avatars'));

app.use(cors());
//{ 
//   origin: 'http://24.144.92.188/',
//   methods:'PUT,GET,POST,PATCH,DELETE',
//   optionsSuccessStatus: 200,
//   credentials: true,
// }
//app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

Role.hasMany(User);
User.belongsTo(Role); 
User.hasMany(CreditHistory);

CreditHistory.belongsTo(User);

User.hasMany(CustomerHistory);
CustomerHistory.belongsTo(User);
sequelize
  //.sync({ force: true })
  .sync({ alter: true })
  .then(res => {
    const PORT =process.env.PORT|| 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.log(err);
  });
