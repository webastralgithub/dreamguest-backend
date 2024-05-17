const User = require('../models/user');
const CustomerHistory = require('../models/userCustomerHistory');
const CreditHistory = require('../models/userCreditHistory');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const sequelize = require('../util/database');
const Sequelize = require('sequelize');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();
const { Op } = Sequelize;
const axios = require('axios');

const nameRegex = /^[a-zA-Z\s]*$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileRegex = /^[0-9]+$/;

const siteURL = process.env.SITE_PRODUCTION_URL || 'http://localhost:3000';

function generateJWT(userId, hasVerifiedOTP, rememberMe) {
  let expiry = '1h';
  if (rememberMe) expiry = '10 days';
  return jwt.sign({ userId: userId, hasVerifiedOTP ,rememberMe}, process.env.JWT_SECRET_KEY, { expiresIn: expiry });
}

function generateOTP() {
  return Math.floor(1000 + (Math.random() * 9000));
}

async function storeOTP(email, OTP) {
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(403).json({ message: "Internal Server Error!" , key: "token_expired"});

    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 5);

    await user.update({ verifyuserOTP: OTP, otpExpiry: expiryTime });
    return true;
  } catch (error) {
    console.error('Error storing OTP:', error);
    return false;
  }
}

async function sendEmail(email, tokenOrOTP, type) {
  let subject, templateFile;

  if (type === 'forgotPassword') {
    subject = 'Reset Password - Loyalty Admin';
    templateFile = 'email-forgotPassword.html';
  } else if (type === 'loginOTP') {
    subject = 'OTP Loyalty Admin';
    templateFile = 'email-loginOTP.html';
  } else {
    return res.status(400).json({ message: "Internal Server Error!" });
  }

  const htmlTemplatePath = path.join(__dirname, '..', 'data', templateFile);
  let htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf-8');

  if (type === 'loginOTP') {
    htmlTemplate = htmlTemplate.replace('{{OTP}}', tokenOrOTP);
  } else if (type === 'forgotPassword') {
    htmlTemplate = htmlTemplate.replace('{{HOST_URL}}', `${siteURL}/reset-password/${tokenOrOTP}`);
  }
 
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_DOMAIN,
      pass: process.env.MAIL_PASSWORD,
    }
  });

  const mailOptions = {
    from: process.env.MAIL_DOMAIN,
    to: email,
    subject: subject,
    html: htmlTemplate
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

function validatePassword(password) {


  const uppercaseRegex = /[A-Z]/;
  const lowercaseRegex = /[a-z]/;
  const numberRegex = /[0-9]/;
  const specialCharRegex = /[^A-Za-z0-9]/;

  const isUppercase = uppercaseRegex.test(password);
  const isLowercase = lowercaseRegex.test(password);
  const hasNumber = numberRegex.test(password);
  const hasSpecialChar = specialCharRegex.test(password);

  return isUppercase && isLowercase && hasNumber && hasSpecialChar;
}

function parseCrime(crimeString) {
  const crimeRegex = /Crime:\s+(.*?),/;
  const convictionDateRegex = /Conviction date:\s+(\d{4}-\d{2}-\d{2})/;
  const statuteRegex = /Statute:\s+(.*?),/;
  const victimAgeRegex = /Victim's age:\s+(\d+)/;
  const victimSexRegex = /Victim's sex:\s+(.*)$/;
  
  const crimeMatch = crimeRegex.exec(crimeString);
  const convictionDateMatch = convictionDateRegex.exec(crimeString);
  const statuteMatch = statuteRegex.exec(crimeString);
  const victimAgeMatch = victimAgeRegex.exec(crimeString);
  const victimSexMatch = victimSexRegex.exec(crimeString);
  
  const crimeType = crimeMatch ? crimeMatch[1].trim() : null;
  const convictionDate = convictionDateMatch ? convictionDateMatch[1] : null;
  const statute = statuteMatch ? statuteMatch[1].trim() : null;
  const victimAge = victimAgeMatch ? parseInt(victimAgeMatch[1]) : null;
  const victimSex = victimSexMatch ? victimSexMatch[1].trim() : null;

  return { crimeType, convictionDate, statute, victimAge, victimSex };
}


exports.registerUser = async (req, res, next) => {
  const { firstName, lastName, email, password, confirm_password, mobile } = req.body;

  if (!firstName || !lastName || !email || !password || !confirm_password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ message: "Passwords does not match" });
  }

  if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
    return res.status(400).json({ message: "Invalid characters in name" });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (mobile && (!mobileRegex.test(mobile))) {
    return res.status(400).json({ message: "Invalid characters in mobile or invalid mobile number" });
  }

  if (!validatePassword(password) || password.length < 10) {
    return res.status(400).json({ message: "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character" });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newUser = await User.create({ firstName, lastName, email, password, userMobile: mobile }, { transaction });

    await transaction.commit();

    return res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("Error registering user:", error);
    if (transaction) await transaction.rollback();
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.loginUser = async (req, res, next) => {
  const { email, password, rememberMe } = req.body;
  console.log(email, password, rememberMe)

  try {
    if (!email || !password) return res.status(401).json({ message: "All fields are required" });

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.failedLoginAttempts >= 6) {
      const lastFailedLoginTime = user.lastFailedLoginAttemptAt;
      const currentTime = new Date();
      const hoursSinceLastFailedLogin = (currentTime - lastFailedLoginTime) / (1000 * 60 * 60);
      if (hoursSinceLastFailedLogin < 24) {
        return res.status(401).json({ message: "Account temporarily blocked. Please try again later." });
      } else {
        await user.update({
          failedLoginAttempts: 0,
          lastFailedLoginAttemptAt: null
        });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await user.update({
        failedLoginAttempts: (user.failedLoginAttempts + 1),
        lastFailedLoginAttemptAt: new Date()
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const otp = generateOTP();

    await sequelize.transaction(async (transaction) => {
      await storeOTP(email, otp);
      await sendEmail(email, otp, 'loginOTP');
    });

    const token = generateJWT(user.id, false, false);
    return res.status(200).json({ message: "OTP sent to registered Email", token: token, rememberMe: rememberMe });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Internal server error", error: error });
  }
};

exports.verifyOTP = async (req, res, next) => {
  const { email, otp, rememberMe } = req.body;
  try {
    let existingUser = await User.findOne({ where: { email } });

    if (!existingUser) {
      return res.status(400).json({ message: "User not found" });
    }

    let storedOTP = existingUser.verifyuserOTP;
    let otpExpiry = existingUser.otpExpiry;

    if (!storedOTP || parseInt(otp) !== storedOTP) {
      return res.status(400).json({ message: "OTP mismatched" });
    }

    if (otpExpiry && otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    let token = generateJWT(existingUser.id, true, rememberMe);
    return res.status(200).json({ message: "User logged in successfully", 'token': token, 'user': existingUser });
  } catch (error) {
    return res.status(400).json({ message: "Invalid OTP", error: error.message });
  }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'Sorry, the email provided is not associated with any user account' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const response = await sendEmail(email, resetToken, 'forgotPassword');
    if (response) return res.status(200).json({ message: "A Reset link has been sent to the register Email" });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res, next) => {

  try {

    const jwtToken = req.authenticated.token;
    if (jwtToken) var decodedJwtToken = jwt.verify(jwtToken, process.env.JWT_SECRET_KEY);

    const { token } = req.params;
    const { password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords does not match" });
    }

    if (!validatePassword(password) || password.length < 10) {
      return res.status(400).json({ message: "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character" });
    }

    const userCondition = req.authenticated.status && decodedJwtToken.hasVerifiedOTP ? { id: decodedJwtToken.userId } :
      { resetPasswordToken: token, resetPasswordExpires: { [Op.gt]: Date.now() } };

    const user = await User.findOne({
      where: userCondition
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.resendOtp = async (req, res, next) => {
  const { email } = req.body;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid Credentials, go back and login again!" });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(403).json({ message: "Internal Server Error!" , key: "token_expired"});
  }

  const otp = generateOTP();

  await storeOTP(email, otp);
  await sendEmail(email, otp, 'loginOTP');

  return res.status(200).json({ message: "OTP sent again to registered Email" });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/avatars');
  },
  filename: function (req, file, cb) {
    const uniqueFileName = `${Date.now()}-${file.originalname}`;
    req.uniqueFileName = uniqueFileName;
    cb(null, uniqueFileName);
  }
});
const upload = multer({ storage: storage });
exports.upload = upload.single('avatarFile');

exports.updateProfile = async (req, res, next) => {
  try {
    const { userName, firstName, lastName, gender } = req.body;
    console.log(userName, firstName, lastName, gender)
    if (!userName || !firstName || !lastName || !gender) {
      return res.status(400).json({ message: 'All Fields are Required' });
    }

    let avatarPath;
    if (req.file) {
      avatarPath = `${req.protocol}://${req.get('host')}/public/avatars/${req.uniqueFileName}`;
    }

    const existingUser = await User.findOne({ where: { username: userName } });

    if (existingUser) {
      return res.status(400).json({ message: 'Enter a unique username' });
    }

    await User.update(
      {
        username: userName,
        firstName,
        lastName,
        gender,
        avatar: avatarPath
      },
      { where: { id: req.authenticated.user.userId } }
    );
    let { dataValues } = await User.findOne({ where: { username: userName } })
    return res.status(200).json({ message: 'Profile updated successfully', user: dataValues });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.buyCredits = async (req, res, next) => {

  const { amount, success_url, cancel_url } = req.body;
  console.log(amount)
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Credits',
            },
            unit_amount: amount*100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url,
      cancel_url,
      metadata: {
        userId: req.authenticated.user.userId,
        totalCredits : amount 
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Unable to create checkout session' });
  }
}

exports.sexOffenderCheck = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const user = await User.findOne({ where: { id: req.authenticated.user.userId } });

    if (!user) {
      return res.status(403).json({ message: "Internal Server Error!", key: "token_expired" });
    }

    if (user.userCredits <= 0) {
      return res.status(400).json({ error: "No credits available" });
    }

    const updatedCredits = user.userCredits - 1;
    const updatedUser = await user.update({ userCredits: updatedCredits }, { transaction , returning: true});

    const { firstName, lastName, state, zipcode } = req.body;

    const apiUrl = `https://api.offenders.io/sexoffender?zipcode=${zipcode}&firstName=${firstName}&lastName=${lastName}&state=${state}&key=${process.env.SEX_OFFENDER_API_KEY}`;
    const { data } = await axios.get(apiUrl);

    const { offenders } = data;
    let result = {};

    if (offenders && offenders.length > 0) {
      const offender = offenders[0];
      const { crime } = offender;

      const { name, address ,offenderImageUrl,dob,city,state,zipcode,sex,age,eyeColor,hairColor,height,weight,race,marks,riskLevel,registrationDate,lat,lng,offenderUrl,firstName_nicknames } = offender;

      const { crimeType, convictionDate ,Statute ,victimAge,victimSex } = parseCrime(crime);

      result = {
        name,address,convictionDate,offenderImageUrl,firstName,lastName,dob,city,state,zipcode,sex,age,eyeColor,hairColor,height,weight,race,marks,riskLevel,registrationDate,lat,lng,offenderUrl,Statute ,victimAge,victimSex,
        firstNameNickNames:JSON.stringify(firstName_nicknames),
        status: false,
        crime: crimeType,
      };
    } else {
      result = {
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        state,
        zipcode,
        status: true
      };
    }

    const customerHistory = await CustomerHistory.create({ ...result }, { transaction });

    await user.addCustomerHistory(customerHistory, { transaction });

    await transaction.commit();

    return res.status(200).json({...result , user : updatedUser});
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error checking sex offender:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getCustomerHistory = async (req, res) => {
  try {
    const history = await CustomerHistory.findAll({where : {userId:req.authenticated.user.userId},order: [['createdAt', 'DESC']]})
    return res.status(200).json({message: 'Data found', data: history});
  } catch (error) {
    console.error('Error getting Customer History :', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.StripeWebhook = async (request, response, next) => {

  let event = request.body;

  // const sig = request.headers['stripe-signature'];
  // try {
  //   event = stripe.webhooks.constructEvent(request.body, sig, process.env.END_POINT_SECRET);
  //   console.log(event);

  // } catch (err) {
  //   response.status(400).send(`Webhook Error: ${err.message}`);
  //   return;
  // }

  switch (event.type) {
      case 'checkout.session.completed':
        const paymentSessionSucceeded = event.data.object;
        const userId = paymentSessionSucceeded.metadata.userId;
        const totalCredits  = paymentSessionSucceeded.metadata.totalCredits;

        try {
          const user = await User.findOne({where:{ id:userId}});
          if(!user) {
            response.status(400).send(`Webhook Error: User Not Found!`);
          }

          let getUserCredits = user.userCredits;
          await user.update({ userCredits: parseInt(totalCredits) + getUserCredits });
          await CreditHistory.create({
            userId,
            creditsPurchased:totalCredits,
            });
          response.send();

        } catch (error) {
          response.status(400).send(`Internal Server Error`);
        }

        break;
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

  response.send();
};

exports.getRefreshedUser = async (req, res, next) => {
  try {
    const userId = req.authenticated.user.userId; 
    const hasVerifiedOTP = req.authenticated.user.hasVerifiedOTP;

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if(!hasVerifiedOTP){
      return res.status(200).json({ user : { email : user.email } });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getPurchaseHistory = async (req, res) => {
  try {
    const history = await CreditHistory.findAll({where : {userId:req.authenticated.user.userId},order: [['createdAt', 'DESC']]})
    return res.status(200).json({message: 'Data found', data: history});
  } catch (error) {
    console.error('Error getting Customer History :', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
