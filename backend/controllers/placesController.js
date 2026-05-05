const Place = require('../models/Place');
const City = require('../models/City');
const User = require('../models/User');
const {
  resolvePlaceImage,
  isExistingImageReliable,
  shouldReplacePlaceImage,
  getFirstUsableImage,
} = require('../utils/placeImages');

const optionalNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const numberFromQuery = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const attachResolvedImage = async (place) => {
  if (!place || !Array.isArray(place.images)) return place;

  const reliableImage = place.images.find(image => isExistingImageReliable(place, image));
  if (reliableImage) return place;

  const currentImage = getFirstUsableImage(place);
  const imageUrl = await resolvePlaceImage(place, { ignoreExisting: true });
  if (!imageUrl) return place;
  if (!shouldReplacePlaceImage(place, currentImage, imageUrl)) return place;

  place.images = [imageUrl];
  if (typeof place.save === 'function') {
    await place.save();
  }
  return place;
};

// @GET /api/places
const getPlaces = async (req, res) => {
  try {
    const { city, category, search, page = 1, limit = 20, lat, lng, radius = 10000, view, north, south, east, west, mine } = req.query;
    const query = {};
    const isMapView = view === 'map';
    const userId = req.user?._id;
    const isAdmin = req.user?.role === 'admin';

    if (mine === 'true' || mine === '1') {
      if (!userId) return res.status(401).json({ message: 'Not authorized' });
      query.addedBy = userId;
    } else if (!isAdmin) {
      const adminIds = await User.find({ role: 'admin' }).distinct('_id');
      query.$or = [
        { visibility: 'public', approved: true },
        { addedBy: { $in: adminIds }, visibility: { $exists: false }, approved: true },
        ...(userId ? [{ addedBy: userId }] : []),
        { addedBy: { $exists: false }, approved: true },
      ];
    }

    if (city) query.city = { $regex: city, $options: 'i' };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    const bounds = {
      north: numberFromQuery(north),
      south: numberFromQuery(south),
      east: numberFromQuery(east),
      west: numberFromQuery(west),
    };
    const hasBounds = Object.values(bounds).every(value => value !== null);

    // Geo query
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius),
        },
      };
    } else if (hasBounds && bounds.north > bounds.south && bounds.east > bounds.west) {
      query.location = {
        $geoWithin: {
          $box: [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
        },
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const findQuery = Place.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    if (isMapView) {
      findQuery
        .select('name description category city location address period entryFee openingHours rating reviewCount panoramaUrl panoramaxImageId streetViewUrl has360 panoramas panoramaItems streetView')
        .lean();
    } else {
      findQuery.populate('addedBy', 'username avatar');
    }

    const [places, total] = await Promise.all([
      findQuery,
      Place.countDocuments(query),
    ]);

    if (!isMapView && places.length <= 60) {
      await Promise.all(places.map(attachResolvedImage));
    }

    res.json({ places, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @GET /api/places/:id
const getPlace = async (req, res) => {
  try {
    const place = await Place.findById(req.params.id).populate('addedBy', 'username avatar role');
    if (!place) return res.status(404).json({ message: 'Place not found' });
    const isOwner = place.addedBy?._id?.toString() === req.user?._id?.toString();
    const isAdmin = req.user?.role === 'admin';
    const isLegacyAdminPlace = place.addedBy?.role === 'admin' && !place.visibility;
    const isPublic = place.visibility === 'public' || isLegacyAdminPlace || !place.addedBy;
    if (!isPublic && !isOwner && !isAdmin) return res.status(404).json({ message: 'Place not found' });
    await attachResolvedImage(place);
    res.json(place);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @POST /api/places
const createPlace = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      city,
      lat,
      lng,
      address,
      period,
      entryFee,
      openingHours,
      website,
      images,
      panoramaUrl,
      panoramaxImageId,
      streetViewUrl,
      panoramas,
      panoramaItems,
      streetView,
      visibility,
    } = req.body;
    const placeVisibility = req.user.role === 'admin'
      ? (visibility === 'private' ? 'private' : 'public')
      : 'private';

    const place = await Place.create({
      name,
      description,
      category,
      city,
      location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      address,
      period,
      entryFee,
      openingHours,
      website,
      images: images || [],
      panoramaUrl,
      panoramaxImageId,
      streetViewUrl,
      panoramas: panoramas || [],
      panoramaItems: Array.isArray(panoramaItems) ? panoramaItems.filter(item => item?.url) : [],
      streetView: {
        panoId: streetView?.panoId || '',
        heading: optionalNumber(streetView?.heading, 0),
        pitch: optionalNumber(streetView?.pitch, 0),
        fov: optionalNumber(streetView?.fov, 80),
        radius: optionalNumber(streetView?.radius, 500),
        maxDistance: optionalNumber(streetView?.maxDistance, 500),
      },
      addedBy: req.user._id,
      visibility: placeVisibility,
    });

    if (placeVisibility === 'public') {
      await City.findOneAndUpdate({ name: { $regex: city, $options: 'i' } }, { $inc: { placeCount: 1 } });
    }

    res.status(201).json(place);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @PUT /api/places/:id
const updatePlace = async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ message: 'Place not found' });

    const isOwner = place.addedBy?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

    const { lat, lng, visibility, ...rest } = req.body;
    Object.assign(place, rest);
    if (req.user.role === 'admin' && ['public', 'private'].includes(visibility)) {
      place.visibility = visibility;
    }
    if (lat && lng) place.location = { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] };

    const updated = await place.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @DELETE /api/places/:id
const deletePlace = async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ message: 'Place not found' });

    const isOwner = place.addedBy?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

    if (place.visibility === 'public') {
      await City.findOneAndUpdate({ name: { $regex: place.city, $options: 'i' } }, { $inc: { placeCount: -1 } });
    }
    await place.deleteOne();
    res.json({ message: 'Place deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPlaces, getPlace, createPlace, updatePlace, deletePlace };
