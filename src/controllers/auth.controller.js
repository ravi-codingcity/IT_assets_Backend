const User = require('../models/User.model');

// Helper: Send response
const send = (res, status, data, message) => {
  res.status(status).json({ success: status < 400, data, message });
};

// POST /auth/signup - Register new user
exports.signup = async (req, res, next) => {
  try {
    const { username, name, role, password } = req.body;

    // Check if username exists
    if (await User.exists({ username: username.toLowerCase() })) {
      return send(res, 409, null, 'Username already exists');
    }

    // Create user
    const user = await User.create({ username, name, role, password });

    // Return user without password
    const userData = { _id: user._id, username: user.username, name: user.name, role: user.role };
    send(res, 201, userData, 'User registered successfully');
  } catch (err) { next(err); }
};

// POST /auth/login - Login user
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return send(res, 401, null, 'Invalid username or password');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return send(res, 401, null, 'Invalid username or password');
    }

    // Return user data (without password)
    const userData = { _id: user._id, username: user.username, name: user.name, role: user.role };
    send(res, 200, userData, 'Login successful');
  } catch (err) { next(err); }
};

// POST /auth/reset-password - Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { username, newPassword } = req.body;

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return send(res, 404, null, 'User not found');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    send(res, 200, null, 'Password reset successfully');
  } catch (err) { next(err); }
};
