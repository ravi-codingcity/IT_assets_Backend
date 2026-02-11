const { body, validationResult } = require('express-validator');

const DEVICES = ['Desktop', 'Laptop', 'Tablet', 'Monitor', 'Printer', 'Scanner', 'Server', 'Network Device', 'Other'];
const STATUSES = ['Active', 'Inactive', 'Under Maintenance', 'Disposed', 'Lost'];

// Validation check middleware
const check = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array().map(e => e.msg).join(', ') });
  }
  next();
};

// Required field validator
const required = (field) => body(field).notEmpty().withMessage(`${field} is required`).trim();

// Create asset validation
exports.validateAsset = [
  required('serialNumber'),
  required('companyName'),
  required('branch'),
  required('department'),
  required('userName'),
  required('brand'),
  body('device').notEmpty().withMessage('Device is required').isIn(DEVICES).withMessage('Invalid device type'),
  required('deviceSerialNo'),
  body('dateOfPurchase').notEmpty().withMessage('Date of purchase is required').isISO8601().withMessage('Invalid date'),
  body('operatingSystem').optional().trim(),
  body('remark').optional().trim().isLength({ max: 500 }),
  body('createdBy').notEmpty().withMessage('createdBy is required').isMongoId().withMessage('Invalid user ID'),
  check
];

// Update asset validation (all optional)
exports.validateAssetUpdate = [
  body('serialNumber').optional().trim(),
  body('companyName').optional().trim(),
  body('branch').optional().trim(),
  body('department').optional().trim(),
  body('userName').optional().trim(),
  body('brand').optional().trim(),
  body('device').optional().isIn(DEVICES).withMessage('Invalid device type'),
  body('deviceSerialNo').optional().trim(),
  body('dateOfPurchase').optional().isISO8601().withMessage('Invalid date'),
  body('operatingSystem').optional().trim(),
  body('remark').optional().trim().isLength({ max: 500 }),
  body('status').optional().isIn(STATUSES).withMessage('Invalid status'),
  check
];
