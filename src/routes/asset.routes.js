const router = require('express').Router();
const controller = require('../controllers/asset.controller');
const { validateAsset, validateAssetUpdate } = require('../middleware/validators/asset.validator');

// Stats & bulk (before :id routes)
router.get('/stats/overview', controller.getAssetStats);
router.post('/bulk', controller.bulkCreateAssets);
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
