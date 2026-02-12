const router = require('express').Router();
const multer = require('multer');
const controller = require('../controllers/asset.controller');
const { validateAsset, validateAssetUpdate } = require('../middleware/validators/asset.validator');

// Configure multer for Excel file uploads (memory storage for buffer access)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) and CSV are allowed'), false);
    }
  }
});

// Stats & filter options
router.get('/stats/overview', controller.getAssetStats);
router.get('/filters', controller.getFilterOptions);
router.get('/export', controller.exportAssets);

// Bulk operations (before :id routes)
router.post('/bulk', controller.bulkCreateAssets);
router.post('/upload-excel', upload.single('file'), controller.uploadExcel);
router.get('/serial/:serialNumber', controller.getAssetBySerialNumber);

// CRUD routes
router.route('/')
  .get(controller.getAllAssets)
  .post(validateAsset, controller.createAsset);

router.route('/:id')
  .get(controller.getAssetById)
  .put(validateAssetUpdate, controller.updateAsset)
  .delete(controller.deleteAsset);

router.delete('/:id/permanent', controller.permanentDeleteAsset);

module.exports = router;
