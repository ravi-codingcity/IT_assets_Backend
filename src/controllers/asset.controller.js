const Asset = require('../models/Asset.model');

// Helper: Send JSON response
const send = (res, status, data, message) => {
  res.status(status).json({ success: status < 400, data, message });
};

// GET /assets - List all assets with pagination, filters, search
exports.getAllAssets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc', search, ...filters } = req.query;
    const currentPage = Math.max(1, parseInt(page));
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit))); // Max 100 per page
    const skip = (currentPage - 1) * pageLimit;

    // Build filter
    const query = { isDeleted: false };
    ['companyName', 'branch', 'department', 'status', 'device'].forEach(f => {
      if (filters[f]) query[f] = filters[f];
    });
    if (filters.userName) query.userName = new RegExp(filters.userName, 'i');
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ serialNumber: regex }, { userName: regex }, { deviceSerialNo: regex }, { brand: regex }];
    }

    // Execute queries in parallel
    const [assets, total] = await Promise.all([
      Asset.find(query).sort({ [sortBy]: order === 'asc' ? 1 : -1 }).skip(skip).limit(pageLimit).lean(),
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

// POST /assets/bulk - Bulk create assets
exports.bulkCreateAssets = async (req, res, next) => {
  try {
    const { assets } = req.body;
    if (!Array.isArray(assets) || !assets.length) {
      return send(res, 400, null, 'Provide an array of assets');
    }
    if (assets.length > 100) {
      return send(res, 400, null, 'Maximum 100 assets allowed');
    }

    // Use insertMany for better performance (with ordered: false to continue on errors)
    const result = await Asset.insertMany(assets, { ordered: false }).catch(err => {
      if (err.insertedDocs) return { inserted: err.insertedDocs, errors: err.writeErrors };
      throw err;
    });

    const inserted = Array.isArray(result) ? result : result.inserted || [];
    send(res, 201, { created: inserted.length, assets: inserted }, `${inserted.length} assets created`);
  } catch (err) { next(err); }
};
