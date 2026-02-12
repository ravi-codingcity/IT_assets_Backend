const router = require('express').Router();
const { body } = require('express-validator');
const { signup, login, resetPassword } = require('../controllers/auth.controller');

// Validation middleware
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array().map(e => e.msg).join(', ') });
  }
  next();
};

// Signup validation
const signupValidation = [
  body('username').notEmpty().withMessage('Username is required').trim(),
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('role').optional().isIn(['admin', 'manager', 'user']).withMessage('Invalid role'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
];

// Login validation
const loginValidation = [
  body('username').notEmpty().withMessage('Username is required').trim(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

// Reset password validation
const resetValidation = [
  body('username').notEmpty().withMessage('Username is required').trim(),
  body('oldPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  validate
];

// Routes
router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.post('/reset-password', resetValidation, resetPassword);

module.exports = router;
