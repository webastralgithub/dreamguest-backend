const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/user');

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (req.url.startsWith('/reset-password/')) {
    req.authenticated = { status: (token ? true : false), token: (token ? token : null) };
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Missing token', key: "token_expired" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Forbidden: Invalid token', key: "token_expired" });
    }
    const user = await User.findOne({ where : { id: decoded.userId}});

    if(!user) return res.status(401).json({ message: 'Unauthorized: User not found', key: "token_expired" });
    req.authenticated = { status: true, user: decoded };
    next();
  });
}
