const express = require('express');
const router = express.Router();
const { getPlaces, getPlace, createPlace, updatePlace, deletePlace } = require('../controllers/placesController');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');

router.get('/', optionalAuth, getPlaces);
router.get('/:id', optionalAuth, getPlace);
router.post('/', protect, adminOnly, createPlace);
router.put('/:id', protect, updatePlace);
router.delete('/:id', protect, deletePlace);

module.exports = router;
