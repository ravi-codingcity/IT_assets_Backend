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

    // Map Excel columns to schema fields (flexible column mapping - case insensitive)
    const columnMap = {
      // Serial Number variations (optional - frontend will add if missing)
      'serialnumber': 'serialNumber', 'serial number': 'serialNumber', 'serial_number': 'serialNumber', 
      'sn': 'serialNumber', 'sr no': 'serialNumber', 'sr.no': 'serialNumber', 'sr. no': 'serialNumber',
      'srno': 'serialNumber', 'sl no': 'serialNumber', 'sl.no': 'serialNumber', 'slno': 'serialNumber',
      'asset id': 'serialNumber', 'assetid': 'serialNumber', 'asset_id': 'serialNumber',
      
      // Company Name variations
      'companyname': 'companyName', 'company name': 'companyName', 'company': 'companyName',
      'organization': 'companyName', 'org': 'companyName', 'firm': 'companyName',
      
      // Branch variations
      'branch': 'branch', 'location': 'branch', 'site': 'branch', 'office': 'branch',
      
      // Department variations
      'department': 'department', 'dept': 'department', 'division': 'department', 'team': 'department',
      
      // User Name variations
      'username': 'userName', 'user name': 'userName', 'user': 'userName', 'name': 'userName',
      'employee': 'userName', 'employee name': 'userName', 'employeename': 'userName',
      'assigned to': 'userName', 'assignedto': 'userName', 'assigned': 'userName',
      
      // Brand variations
      'brand': 'brand', 'make': 'brand', 'manufacturer': 'brand', 'vendor': 'brand',
      
      // Device type variations
      'device': 'device', 'device type': 'device', 'devicetype': 'device', 'type': 'device',
      'asset type': 'device', 'assettype': 'device', 'equipment': 'device', 'category': 'device',
      
      // Device Serial No variations
      'deviceserialno': 'deviceSerialNo', 'device serial no': 'deviceSerialNo', 'device serial': 'deviceSerialNo', 
      'device_serial': 'deviceSerialNo', 'device serial number': 'deviceSerialNo', 'deviceserialnumber': 'deviceSerialNo',
      'equipment serial': 'deviceSerialNo', 'equipment serial no': 'deviceSerialNo', 
      'asset serial': 'deviceSerialNo', 'asset serial no': 'deviceSerialNo',
      'serial no': 'deviceSerialNo', 'serialno': 'deviceSerialNo', 'product serial': 'deviceSerialNo',
      'device s.no': 'deviceSerialNo', 'device sno': 'deviceSerialNo',
      
      // Operating System variations
      'operatingsystem': 'operatingSystem', 'operating system': 'operatingSystem', 'os': 'operatingSystem',
      
      // Date of Purchase variations
      'dateofpurchase': 'dateOfPurchase', 'date of purchase': 'dateOfPurchase', 'purchase date': 'dateOfPurchase', 
      'purchasedate': 'dateOfPurchase', 'purchase_date': 'dateOfPurchase', 'purchased on': 'dateOfPurchase',
      'date': 'dateOfPurchase', 'bought on': 'dateOfPurchase', 'acquisition date': 'dateOfPurchase',
      'purchase': 'dateOfPurchase',
      
      // Remark variations
      'remark': 'remark', 'remarks': 'remark', 'notes': 'remark', 'comment': 'remark', 'comments': 'remark',
      'description': 'remark',
      
      // Status variations
      'status': 'status', 'state': 'status', 'condition': 'status'
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
      
      // Set default values for blank/empty fields - use "NA" for missing text fields
      const textFields = ['companyName', 'branch', 'department', 'userName', 'brand', 'device', 'deviceSerialNo', 'operatingSystem', 'remark'];
      textFields.forEach(field => {
        if (!asset[field] || asset[field] === '') {
          asset[field] = 'NA';
        }
      });
      
      // Handle device field - map to valid enum or default to 'Other'
      const validDevices = ['Desktop', 'Laptop', 'Tablet', 'Monitor', 'Printer', 'Scanner', 'Server', 'Network Device', 'Other', 'NA'];
      if (asset.device) {
        // Try to match device type (case-insensitive)
        const matchedDevice = validDevices.find(d => d.toLowerCase() === asset.device.toLowerCase());
        asset.device = matchedDevice || 'Other';
      } else {
        asset.device = 'Other';
      }
      
      // Set default status if not provided
      if (!asset.status || asset.status === '') {
        asset.status = 'Active';
      }
      
      // Set default date if not provided (current date)
      if (!asset.dateOfPurchase) {
        asset.dateOfPurchase = new Date();
      }
      
      // Auto-generate serialNumber if not provided (will be replaced by frontend's value)
      if (!asset.serialNumber || asset.serialNumber === '' || asset.serialNumber === 'NA') {
        // Generate unique serial: IT-YYYYMMDD-HHMMSS-INDEX
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
        asset.serialNumber = `IT-${dateStr}-${timeStr}-${String(index + 1).padStart(4, '0')}`;
      }
      
      asset._rowIndex = index + 2; // Row number in Excel (1-based + header)
      return asset;
    });

    // No validation errors needed - all fields have defaults now
    // Just filter out completely empty rows
    const validAssets = assets.filter(asset => {
      // Check if at least one meaningful field has real data (not just "NA")
      const hasData = ['companyName', 'branch', 'department', 'userName', 'brand', 'device', 'deviceSerialNo']
        .some(f => asset[f] && asset[f] !== 'NA' && asset[f] !== '');
      if (hasData) {
        delete asset._rowIndex;
        return true;
      }
      return false;
    });

    if (!validAssets.length) {
      // Include detected headers for debugging
      const detectedHeaders = rawData.length > 0 ? Object.keys(rawData[0]) : [];
      return send(res, 400, { 
        detectedHeaders,
        message: 'All rows appear to be empty. Make sure your Excel has data in at least one of these columns.',
        expectedColumns: ['companyName', 'branch', 'department', 'userName', 'brand', 'device', 'deviceSerialNo', 'dateOfPurchase', 'operatingSystem', 'remark', 'status']
      }, 'No valid records found. Check that your Excel has data.');
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
      failed: results.errors.length,
      skippedEmptyRows: rawData.length - validAssets.length,
      insertErrors: results.errors.slice(0, 50)
    }, `Excel processed: ${results.inserted.length} created, ${results.errors.length} failed`);
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
