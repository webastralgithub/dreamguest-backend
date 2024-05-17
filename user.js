const path = require('path');
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const { authenticateToken } = require('../controllers/authentication');
const { StripeWebhook } = require('../controllers/stripeWebhook');

router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/verify-otp', authenticateToken, userController.verifyOTP);

router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password/:token', authenticateToken, userController.resetPassword);
router.post('/resend-otp/', authenticateToken, userController.resendOtp);
router.post('/update-user-profile', authenticateToken, userController.upload, userController.updateProfile);
router.post('/buy-credits', authenticateToken, userController.buyCredits);
router.post('/check-sex-offender', authenticateToken, userController.sexOffenderCheck);
router.get('/get-customer-history', authenticateToken, userController.getCustomerHistory);
router.post('api/v1/dream-guest/stript-webhook',StripeWebhook);

module.exports = router;