const Asset = require('../models/Asset.model');
const XLSX = require('xlsx');

// Helper: Send JSON response
const send = (res, status, data, message) => {
  res.status(status).json({ success: status < 400, data, message });
};

// GET /assets - List all assets with pagination, filters, search
exports.getAllAssets = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'createdAt', 
      order = 'desc', 
      search,
      // Date range filters
      dateFrom,
      dateTo,
      // Multiple value filters (comma-separated)
      ...filters 
    } = req.query;
    
    const currentPage = Math.max(1, parseInt(page));
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit))); // Max 100 per page
    const skip = (currentPage - 1) * pageLimit;

    // Build filter query
    const query = { isDeleted: false };
    
    // Exact match filters (support comma-separated multiple values)
    ['companyName', 'branch', 'department', 'status', 'device', 'brand', 'operatingSystem'].forEach(f => {
      if (filters[f]) {
        const values = filters[f].split(',').map(v => v.trim()).filter(Boolean);
        query[f] = values.length > 1 ? { $in: values } : values[0];
      }
    });
    
    // Partial match filters (case-insensitive)
    if (filters.userName) query.userName = new RegExp(filters.userName, 'i');
    if (filters.serialNumber) query.serialNumber = new RegExp(filters.serialNumber, 'i');
    if (filters.deviceSerialNo) query.deviceSerialNo = new RegExp(filters.deviceSerialNo, 'i');
    
    // Date range filter for dateOfPurchase
    if (dateFrom || dateTo) {
      query.dateOfPurchase = {};
      if (dateFrom) query.dateOfPurchase.$gte = new Date(dateFrom);
      if (dateTo) query.dateOfPurchase.$lte = new Date(dateTo);
    }
    
    // Created by filter
    if (filters.createdBy) query.createdBy = filters.createdBy;
    
    // Global search across multiple fields
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { serialNumber: regex },
        { userName: regex },
        { deviceSerialNo: regex },
        { brand: regex },
        { companyName: regex },
        { branch: regex },
        { department: regex },
        { remark: regex }
      ];
    }

    // Execute queries in parallel
    const [assets, total] = await Promise.all([
      Asset.find(query)
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate('createdBy', 'username name')
        .lean(),
      Asset.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / pageLimit);
    
    // Enhanced pagination info for frontend
    const pagination = {
      currentPage,
      totalPages,
      totalItems: total,
      itemsPerPage: pageLimit,
      itemsOnPage: assets.length,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null
    };

    send(res, 200, { assets, pagination }, 'Assets retrieved');
  } catch (err) { next(err); }
};

// GET /assets/:id - Get single asset
exports.getAssetById = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false }).lean();
    if (!asset) return send(res, 404, null, 'Asset not found');
    send(res, 200, asset, 'Asset retrieved');
  } catch (err) { next(err); }
};

// GET /assets/serial/:serialNumber - Get by serial number
exports.getAssetBySerialNumber = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ serialNumber: req.params.serialNumber.toUpperCase(), isDeleted: false }).lean();
    if (!asset) return send(res, 404, null, 'Asset not found');
    send(res, 200, asset, 'Asset retrieved');
  } catch (err) { next(err); }
};

// POST /assets - Create new asset
exports.createAsset = async (req, res, next) => {
  try {
    const { serialNumber, createdBy } = req.body;
    
    // Validate createdBy is provided
    if (!createdBy) {
      return send(res, 400, null, 'createdBy (user ID) is required');
    }
    
    // Check duplicate
    if (await Asset.exists({ serialNumber: serialNumber.toUpperCase() })) {
      return send(res, 409, null, 'Asset with this serial number already exists');
    }

    const asset = await Asset.create(req.body);
    send(res, 201, asset, 'Asset created');
  } catch (err) { next(err); }
};

// PUT /assets/:id - Update asset
exports.updateAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return send(res, 404, null, 'Asset not found');

    // Check serial number duplicate if updating
    if (req.body.serialNumber && req.body.serialNumber.toUpperCase() !== asset.serialNumber) {
      if (await Asset.exists({ serialNumber: req.body.serialNumber.toUpperCase(), _id: { $ne: req.params.id } })) {
        return send(res, 409, null, 'Serial number already exists');
      }
    }

    Object.assign(asset, req.body);
    await asset.save();
    send(res, 200, asset, 'Asset updated');
  } catch (err) { next(err); }
};

// DELETE /assets/:id - Soft delete
exports.deleteAsset = async (req, res, next) => {
  try {
    const result = await Asset.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!result) return send(res, 404, null, 'Asset not found');
    send(res, 200, null, 'Asset deleted');
  } catch (err) { next(err); }
};

// DELETE /assets/:id/permanent - Hard delete
exports.permanentDeleteAsset = async (req, res, next) => {
  try {
    const result = await Asset.findByIdAndDelete(req.params.id);
    if (!result) return send(res, 404, null, 'Asset not found');
    send(res, 200, null, 'Asset permanently deleted');
  } catch (err) { next(err); }
};

// GET /assets/stats/overview - Get statistics
exports.getAssetStats = async (req, res, next) => {
  try {
    const matchActive = { $match: { isDeleted: false } };
    
    // Run all aggregations in parallel for better performance
    const [overview, byDevice, byCompany, byDepartment] = await Promise.all([
      Asset.aggregate([
        matchActive,
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
            maintenance: { $sum: { $cond: [{ $eq: ['$status', 'Under Maintenance'] }, 1, 0] } }
          }
        }
      ]),
      Asset.aggregate([matchActive, { $group: { _id: '$device', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Asset.aggregate([matchActive, { $group: { _id: '$company', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Asset.aggregate([matchActive, { $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    ]);

    send(res, 200, {
      overview: overview[0] || { total: 0, active: 0, inactive: 0, maintenance: 0 },
      byDevice,
      byCompany,
      byDepartment
    }, 'Statistics retrieved');
  } catch (err) { next(err); }
};

// POST /assets/bulk - Bulk create assets from JSON
exports.bulkCreateAssets = async (req, res, next) => {
  try {
    const { assets, createdBy } = req.body;
    if (!Array.isArray(assets) || !assets.length) {
      return send(res, 400, null, 'Provide an array of assets');
    }
    if (assets.length > 1000) {
      return send(res, 400, null, 'Maximum 1000 assets allowed per batch');
    }
    if (!createdBy) {
      return send(res, 400, null, 'createdBy (user ID) is required');
    }

    // Add createdBy to each asset
    const assetsWithCreator = assets.map(asset => ({ ...asset, createdBy }));

    // Use insertMany with ordered: false for better performance
    const result = await Asset.insertMany(assetsWithCreator, { ordered: false }).catch(err => {
      if (err.insertedDocs) return { inserted: err.insertedDocs, errors: err.writeErrors };
      throw err;
    });

    const inserted = Array.isArray(result) ? result : result.inserted || [];
    const errors = result.errors || [];
    
    send(res, 201, { 
      created: inserted.length, 
      failed: errors.length,
      assets: inserted,
      errors: errors.map(e => ({ index: e.index, message: e.errmsg || e.message }))
    }, `${inserted.length} assets created, ${errors.length} failed`);
  } catch (err) { next(err); }
};

// POST /assets/upload-excel - Bulk upload from Excel file
exports.uploadExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return send(res, 400, null, 'Please upload an Excel file');
    }
    
    const { createdBy } = req.body;
    if (!createdBy) {
      return send(res, 400, null, 'createdBy (user ID) is required');
    }

    // Parse Excel file from buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData.length) {
      return send(res, 400, null, 'Excel file is empty');
    }

    if (rawData.length > 5000) {
      return send(res, 400, null, 'Maximum 5000 records allowed per file');
    }

    // Map Excel columns to schema fields (flexible column mapping)
    const columnMap = {
      'serialnumber': 'serialNumber', 'serial number': 'serialNumber', 'serial_number': 'serialNumber', 'sn': 'serialNumber',
      'companyname': 'companyName', 'company name': 'companyName', 'company': 'companyName',
      'branch': 'branch',
      'department': 'department', 'dept': 'department',
      'username': 'userName', 'user name': 'userName', 'user': 'userName', 'name': 'userName',
      'brand': 'brand',
      'device': 'device', 'device type': 'device', 'devicetype': 'device',
      'deviceserialno': 'deviceSerialNo', 'device serial no': 'deviceSerialNo', 'device serial': 'deviceSerialNo', 'device_serial': 'deviceSerialNo',
      'operatingsystem': 'operatingSystem', 'operating system': 'operatingSystem', 'os': 'operatingSystem',
      'dateofpurchase': 'dateOfPurchase', 'date of purchase': 'dateOfPurchase', 'purchase date': 'dateOfPurchase', 'purchasedate': 'dateOfPurchase',
      'remark': 'remark', 'remarks': 'remark', 'notes': 'remark', 'comment': 'remark',
      'status': 'status'
    };

    // Transform Excel data to match schema
    const assets = rawData.map((row, index) => {
      const asset = { createdBy };
      
      Object.keys(row).forEach(key => {
        const normalizedKey = key.toLowerCase().trim();
        const schemaField = columnMap[normalizedKey];
        
        if (schemaField) {
          let value = row[key];
          
          // Handle date conversion
          if (schemaField === 'dateOfPurchase' && value) {
            if (value instanceof Date) {
              asset[schemaField] = value;
            } else {
              const parsed = new Date(value);
              asset[schemaField] = isNaN(parsed.getTime()) ? null : parsed;
            }
          } else {
            asset[schemaField] = typeof value === 'string' ? value.trim() : value;
          }
        }
      });
      
      asset._rowIndex = index + 2; // Row number in Excel (1-based + header)
      return asset;
    });

    // Validate required fields
    const validAssets = [];
    const validationErrors = [];
    const requiredFields = ['serialNumber', 'companyName', 'branch', 'department', 'userName', 'brand', 'device', 'deviceSerialNo', 'dateOfPurchase'];

    assets.forEach(asset => {
      const missing = requiredFields.filter(f => !asset[f]);
      if (missing.length) {
        validationErrors.push({ row: asset._rowIndex, missing, serialNumber: asset.serialNumber || 'N/A' });
      } else {
        delete asset._rowIndex;
        validAssets.push(asset);
      }
    });

    if (!validAssets.length) {
      return send(res, 400, { validationErrors }, 'No valid records found');
    }

    // Insert in batches of 500 for large datasets
    const batchSize = 500;
    const results = { inserted: [], errors: [] };

    for (let i = 0; i < validAssets.length; i += batchSize) {
      const batch = validAssets.slice(i, i + batchSize);
      try {
        const inserted = await Asset.insertMany(batch, { ordered: false });
        results.inserted.push(...inserted);
      } catch (err) {
        if (err.insertedDocs) results.inserted.push(...err.insertedDocs);
        if (err.writeErrors) {
          results.errors.push(...err.writeErrors.map(e => ({
            serialNumber: batch[e.index]?.serialNumber,
            message: e.errmsg?.includes('duplicate') ? 'Duplicate serial number' : e.errmsg
          })));
        }
      }
    }

    send(res, 201, {
      totalRows: rawData.length,
      created: results.inserted.length,
      failed: results.errors.length + validationErrors.length,
      validationErrors: validationErrors.slice(0, 50), // Limit error details
      insertErrors: results.errors.slice(0, 50)
    }, `Excel processed: ${results.inserted.length} created, ${results.errors.length + validationErrors.length} failed`);
  } catch (err) { 
    if (err.message?.includes('Encrypted')) {
      return send(res, 400, null, 'Cannot read password-protected Excel files');
    }
    next(err); 
  }
};

// GET /assets/export - Export assets to JSON (for Excel generation on frontend)
exports.exportAssets = async (req, res, next) => {
  try {
    const { format = 'json', ...filters } = req.query;
    
    // Build filter query (reuse logic from getAllAssets)
    const query = { isDeleted: false };
    
    ['companyName', 'branch', 'department', 'status', 'device', 'brand'].forEach(f => {
      if (filters[f]) {
        const values = filters[f].split(',').map(v => v.trim()).filter(Boolean);
        query[f] = values.length > 1 ? { $in: values } : values[0];
      }
    });

    if (filters.createdBy) query.createdBy = filters.createdBy;
    
    // Get all matching assets (no pagination for export)
    const assets = await Asset.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username name')
      .lean();

    send(res, 200, { assets, total: assets.length }, 'Assets exported');
  } catch (err) { next(err); }
};

// GET /assets/filters - Get available filter options
exports.getFilterOptions = async (req, res, next) => {
  try {
    const [companies, branches, departments, devices, statuses, brands] = await Promise.all([
      Asset.distinct('companyName', { isDeleted: false }),
      Asset.distinct('branch', { isDeleted: false }),
      Asset.distinct('department', { isDeleted: false }),
      Asset.distinct('device', { isDeleted: false }),
      Asset.distinct('status', { isDeleted: false }),
      Asset.distinct('brand', { isDeleted: false })
    ]);

    send(res, 200, {
      companies: companies.sort(),
      branches: branches.sort(),
      departments: departments.sort(),
      devices: devices.sort(),
      statuses: statuses.sort(),
      brands: brands.sort()
    }, 'Filter options retrieved');
  } catch (err) { next(err); }
};
