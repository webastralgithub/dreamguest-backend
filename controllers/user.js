const User = require("../models/user");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const sequelize = require("../util/database");
const Sequelize = require("sequelize");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mailgunTransport = require("nodemailer-mailgun-transport");
const crypto = require("crypto");
const multer = require("multer");
const { encrypt, decrypt } = require("../util/crypto-utils");
const stripe = require("stripe")(
  "sk_test_51OvxzWSFFtxFGoDYq8EjxnQv0DwWT3VlTde9PoU5p98QSE3fXlWRauRJN2Q6NgU8sED1iK6bafgrX0fPvlRZt3By00poBUSXRR"
);
require("dotenv").config();
const { Op } = Sequelize;

const nameRegex = /^[a-zA-Z\s]*$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileRegex = /^[0-9]+$/;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

const siteURL = process.env.SITE_PRODUCTION_URL || "http://localhost:3000";

function generateJWT(userId, hasVerifiedOTP, rememberMe, roleId) {
  let expiry = "1h";
  if (rememberMe) expiry = "10 days";
  return jwt.sign(
    { userId: userId, hasVerifiedOTP: hasVerifiedOTP, roleId: roleId },
    process.env.JWT_SECRET_KEY,
    { expiresIn: expiry }
  );
}

function generateRandomString(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000);
}

async function storeOTP(email, OTP) {
  try {
   const encryptedEamil = encrypt(email);
    const user = await User.findOne({ where: { email:encryptedEamil } });
    if (!user)
      return res.status(400).json({ message: "Internal Server Error!" });

    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 5);

    await user.update({ verifyuserOTP: OTP, otpExpiry: expiryTime });
    return true;
  } catch (error) {
    console.error("Error storing OTP:", error);
    return false;
  }
}

async function sendEmail(email, tokenOrOTPOrUniqueCode, type) {
  let subject, templateFile;

  if (type === "forgotPassword") {
    subject = "OTP Loyalty Admin";
    templateFile = "email-forgotPassword.html";
  } else if (type === "loginOTP") {
    subject = "Reset Password - Loyalty Admin";
    templateFile = "email-loginOTP.html";
  } else if (type === "unique_code") {
    subject = "Unique Code- Loyalty Admin";
    templateFile = "email-uniqueCode.html";
  } else {
    return res.status(400).json({ message: "Internal Server Error!" });
  }

  const htmlTemplatePath = path.join(__dirname, "..", "data", templateFile);
  let htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");

  if (type === "loginOTP") {
    htmlTemplate = htmlTemplate.replace("{{OTP}}", tokenOrOTPOrUniqueCode);
  } else if (type === "forgotPassword") {
    htmlTemplate = htmlTemplate.replace(
      "{{HOST_URL}}",
      `${siteURL}/reset-password/${tokenOrOTPOrUniqueCode}`
    );
  } else if (type === "unique_code") {
    htmlTemplate = htmlTemplate.replace(
      "{{UNIQUECODE}}",
      tokenOrOTPOrUniqueCode
    );
  }

  //   const auth = {
  //     auth: {
  //         api_key: process.env.MAILGUN_API_KEY,
  //         domain: process.env.MAILGUN_DOMAIN
  //     }
  // };
  // const transporter = nodemailer.createTransport(mailgunTransport(auth));

  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_DOMAIN,
      pass: process.env.MAIL_PASSWORD,
    },
  });
  const mailOptions = {
    from: process.env.MAIL_DOMAIN,
    to: email,
    subject: subject,
    html: htmlTemplate,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
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

exports.registerUser = async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    password,
    confirm_password,
    mobile,
    guest,
    address,
  } = req.body;

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

  if (mobile && (!mobileRegex.test(mobile) || mobile.length < 10)) {
    return res
      .status(400)
      .json({
        message: "Invalid characters in mobile or invalid mobile number",
      });
  }

  if (!validatePassword(password) || password.length < 10) {
    return res
      .status(400)
      .json({
        message:
          "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character and password length must be greater than or equal to 10",
      });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const encryptedEamil = encrypt(email);
    const existingUser = await User.findOne({ where: { email:encryptedEamil } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const unique_code = generateRandomString(6);
    const newUser = await User.create(
      {
        firstName,
        lastName,
        email,
        password,
        mobile,
        roleId: guest ? 2 : 1,
        unique_code: unique_code,
        address: guest ? address : "",
      },
      { transaction }
    );

    await transaction.commit();

    if (guest) {
      await sendEmail(email, unique_code, "unique_code");
      client.messages
        .create({
          body: `Your Unique Code is ${unique_code}`,
          from: "+1 681 395 6749",
          to: "+91 9882885354",
        })
        .then((message) => console.log(message.sid));
      return res
        .status(201)
        .json({
          message:
            "Registered successfully Unique Code sent to your registered email Id and Phone",
          user: newUser,
        });
    }

    return res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("Error registering user:", error);
    if (transaction) await transaction.rollback();
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.loginUser = async (req, res, next) => {
  const { email, password, rememberMe } = req.body;

  try {
    if (!email || !password)
      return res.status(401).json({ message: "All fields are required" });
    const encryptedEamil = encrypt(email);
    const user = await User.findOne({ where: { email: encryptedEamil } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.failedLoginAttempts >= 6) {
      const lastFailedLoginTime = user.lastFailedLoginAttemptAt;
      const currentTime = new Date();
      const hoursSinceLastFailedLogin =
        (currentTime - lastFailedLoginTime) / (1000 * 60 * 60);
      if (hoursSinceLastFailedLogin < 24) {
        return res
          .status(401)
          .json({
            message: "Account temporarily blocked. Please try again later.",
          });
      } else {
        await user.update({
          failedLoginAttempts: 0,
          lastFailedLoginAttemptAt: null,
        });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await user.update({
        failedLoginAttempts: user.failedLoginAttempts + 1,
        lastFailedLoginAttemptAt: new Date(),
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const otp = generateOTP();

    await sequelize.transaction(async (transaction) => {
      await storeOTP(email, otp);
      await sendEmail(email, otp, "loginOTP");
    });
    client.messages
      .create({
        body: otp,
        from: "+1 681 395 6749",
        to: "+91 9882885354",
      })
      .then((message) => console.log(message.sid));
    const token = generateJWT(user.id, false, false);
    return res
      .status(200)
      .json({
        message: "OTP sent to registered Email",
        token: token,
        rememberMe: rememberMe,
      });
  } catch (error) {
    console.error("Error logging in:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error });
  }
};

exports.verifyOTP = async (req, res, next) => {
  const { email, otp, rememberMe } = req.body;
  try {
    const encryptedEamil = encrypt(email);
    let existingUser = await User.findOne({ where: { email: encryptedEamil } });

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

    let token = generateJWT(
      existingUser.id,
      true,
      rememberMe,
      existingUser.roleId
    );
    console.log(token);
    return res
      .status(200)
      .json({
        message: "User logged in successfully",
        token: token,
        user: existingUser,
      });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "Invalid OTP", error: error.message });
  }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const encryptedEamil = encrypt(email);
    const user = await User.findOne({ where: { email: encryptedEamil } });
    if (!user) {
      return res
        .status(404)
        .json({
          message:
            "Sorry, the email provided is not associated with any user account. Please make sure you entered the correct email address or create a new account if you haven't already",
        });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const response = await sendEmail(email, resetToken, "forgotPassword");
    if (response)
      return res
        .status(200)
        .json({ message: "A Reset link has been sent to the register Email" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const jwtToken = req.authenticated.token;
    if (jwtToken)
      var decodedJwtToken = jwt.verify(jwtToken, process.env.JWT_SECRET_KEY);

    const { token } = req.params;
    const { password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords does not match" });
    }

    if (!validatePassword(password) || password.length < 10) {
      return res
        .status(400)
        .json({
          message:
            "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character and password length must be greater than or equal to 10",
        });
    }

    const userCondition =
      req.authenticated.status && decodedJwtToken.hasVerifiedOTP
        ? { id: decodedJwtToken.userId }
        : {
            resetPasswordToken: token,
            resetPasswordExpires: { [Op.gt]: Date.now() },
          };

    const user = await User.findOne({
      where: userCondition,
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.resendOtp = async (req, res, next) => {
  const { email } = req.body;

  if (!emailRegex.test(email)) {
    return res
      .status(400)
      .json({ message: "Invalid Credentials, go back and login again!" });
  }
  const encryptedEamil = encrypt(email);
  const user = await User.findOne({ where: { email: encryptedEamil } });
  if (!user) {
    return res
      .status(401)
      .json({ message: "You are not authorized to make this request" });
  }

  const otp = generateOTP();

  await storeOTP(email, otp);
  await sendEmail(email, otp, "loginOTP");

  return res
    .status(200)
    .json({ message: "OTP sent again to registered Email" });
};
exports.getGuest = async (req, res, next) => {
  const { code } = req.params;
 const unique_code = encrypt(code)
  const user = await User.findOne({ where: { unique_code } });
  if (!user) {
    return res.status(401).json({ message: "No Result Found" });
  }

  return res.status(200).json({ user: user });
};
exports.allGuest = async (req, res, next) => {
  const user = await User.findAll();
  if (!user) {
    return res.status(401).json({ message: "No Result Found" });
  }

  return res.status(200).json({ user: user });
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/avatars");
  },
  filename: function (req, file, cb) {
    const uniqueFileName = `${Date.now()}-${file.originalname}`;
    req.uniqueFileName = uniqueFileName;
    cb(null, uniqueFileName);
  },
});
const upload = multer({ storage: storage });
exports.upload = upload.single("avatarFile");

exports.updateProfile = async (req, res, next) => {
  try {
    const { userName, firstName, lastName, gender } = req.body;
    console.log(userName, firstName, lastName, gender);
    if (!userName || !firstName || !lastName || !gender) {
      return res.status(400).json({ message: "All Fields are Required" });
    }

    let avatarPath;
    if (req.file) {
      avatarPath = `${req.protocol}://${req.get("host")}/public/avatars/${
        req.uniqueFileName
      }`;
    }

    const existingUser = await User.findOne({ where: { username: userName } });

    if (existingUser) {
      return res.status(400).json({ message: "Enter a unique username" });
    }

    let user = await User.update(
      {
        username: userName,
        firstName,
        lastName,
        gender,
        avatar: avatarPath,
      },
      { where: { id: req.authenticated.user.userId } }
    );
    let { dataValues } = await User.findOne({ where: { username: userName } });
    return res
      .status(200)
      .json({ message: "Profile updated successfully", user: dataValues });
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//sk_test_51OvxzWSFFtxFGoDYq8EjxnQv0DwWT3VlTde9PoU5p98QSE3fXlWRauRJN2Q6NgU8sED1iK6bafgrX0fPvlRZt3By00poBUSXRR

//pk_test_51OvxzWSFFtxFGoDYosJgLK33mwpkKsY9xuaIn69LjmHAY95Ri7QO16bkyNc54j6yuFo5oxT1VtPfA9SSgdom3a7000IN9TkMyG
exports.buyCredits = async (req, res, next) => {
  const { amount, success_url, cancel_url } = req.body;
  console.log(amount);
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Credits",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url,
      cancel_url,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ error: "Unable to create checkout session" });
  }
};
