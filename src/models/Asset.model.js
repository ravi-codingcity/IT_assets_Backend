const mongoose = require('mongoose');

const DEVICE_TYPES = ['Desktop', 'Laptop', 'Tablet', 'Monitor', 'Printer', 'Scanner', 'Server', 'Network Device', 'Other'];
const STATUS_TYPES = ['Active', 'Inactive', 'Under Maintenance', 'Disposed', 'Lost'];

const assetSchema = new mongoose.Schema({
  serialNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
  companyName: { type: String, required: true, trim: true },
  branch: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  userName: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  device: { type: String, required: true, enum: DEVICE_TYPES },
  deviceSerialNo: { type: String, required: true, trim: true, uppercase: true },
  operatingSystem: { type: String, trim: true, default: '' },
  dateOfPurchase: { type: Date, required: true },
  remark: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: STATUS_TYPES, default: 'Active' },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Indexes for fast queries
assetSchema.index({ companyName: 1, branch: 1, department: 1 });
assetSchema.index({ status: 1, isDeleted: 1 });
assetSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Asset', assetSchema);
