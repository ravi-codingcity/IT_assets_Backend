const mongoose = require('mongoose');

const DEVICE_TYPES = ['Desktop', 'Laptop', 'Tablet', 'Monitor', 'Printer', 'Scanner', 'Server', 'Network Device', 'Other', 'NA'];
const STATUS_TYPES = ['Active', 'Inactive', 'Under Maintenance', 'Disposed', 'Lost'];

const assetSchema = new mongoose.Schema({
  serialNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
  companyName: { type: String, trim: true, default: 'NA' },
  branch: { type: String, trim: true, default: 'NA' },
  department: { type: String, trim: true, default: 'NA' },
  userName: { type: String, trim: true, default: 'NA' },
  brand: { type: String, trim: true, default: 'NA' },
  device: { type: String, enum: DEVICE_TYPES, default: 'Other' },
  deviceSerialNo: { type: String, trim: true, uppercase: true, default: 'NA' },
  operatingSystem: { type: String, trim: true, default: 'NA' },
  dateOfPurchase: { type: Date, default: Date.now },
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
