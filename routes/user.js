const path = require('path');
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const { authenticateToken } = require('../controllers/authentication');

router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/verify-otp', authenticateToken, userController.verifyOTP);

router.post('/forgot-password', userController.forgotPassword);
router.get('/get-all-guest', userController.allGuest);
router.get('/get-guest/:code', userController.getGuest);
router.post('/reset-password/:token', authenticateToken, userController.resetPassword);
router.post('/resend-otp/', authenticateToken, userController.resendOtp);
router.post('/update-user-profile', authenticateToken, userController.upload, userController.updateProfile);
router.post('/buy-credits', authenticateToken, userController.buyCredits);

module.exports = router;