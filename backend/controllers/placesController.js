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

const parseCoordinate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getCoordinatesFromBody = (body) => {
  const lat = parseCoordinate(body.lat ?? body.latitude ?? body.location?.coordinates?.[1]);
  const lng = parseCoordinate(body.lng ?? body.longitude ?? body.location?.coordinates?.[0]);

  if (lat === null || lng === null) {
    return { error: 'Latitude and longitude are required' };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'Invalid latitude or longitude range' };
  }

  return { lat, lng, coordinates: [lng, lat] };
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const updateCityPlaceCount = async (city, coordinates, increment) => {
  const cityName = String(city || '').trim();
  if (!cityName) return;

  const existingCity = await City.findOneAndUpdate(
    { name: { $regex: `^${escapeRegex(cityName)}$`, $options: 'i' } },
    { $inc: { placeCount: increment } },
    { new: true }
  );

  if (!existingCity && increment > 0 && coordinates) {
    await City.create({
      name: cityName,
      location: { type: 'Point', coordinates },
      description: `${cityName} cultural places`,
      placeCount: 1,
    });
  }
};

const attachResolvedImage = async (place) => {
  if (!place || !Array.isArray(place.images)) return place;

  const reliableImage = place.images.find(image => isExistingImageReliable(place, image));
  if (reliableImage) return place;

  const currentImage = getFirstUsableImage(place);
  const imageUrl = await resolvePlaceImage(place, { ignoreExisting: true });
  if (!imageUrl || !shouldReplacePlaceImage(place, currentImage, imageUrl)) {
    if (currentImage) {
      place.images = [];
      if (typeof place.save === 'function') {
        await place.save();
      }
    }
    return place;
  }

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
    const isAdminAddedPlace = place.addedBy?.role === 'admin';
    const isLegacyAdminPlace = isAdminAddedPlace && !place.visibility;
    const isPublic = place.visibility === 'public' || isLegacyAdminPlace || isAdminAddedPlace || !place.addedBy;
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
      category = 'cultural',
      city,
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
    const coordinateResult = getCoordinatesFromBody(req.body);
    if (coordinateResult.error) return res.status(400).json({ message: coordinateResult.error });
    const cityName = String(city || '').trim();
    if (!cityName) return res.status(400).json({ message: 'City is required' });

    const placeVisibility = req.user.role === 'admin'
      ? (visibility === 'private' ? 'private' : 'public')
      : 'private';

    const place = await Place.create({
      name,
      description,
      category: category || 'cultural',
      city: cityName,
      location: { type: 'Point', coordinates: coordinateResult.coordinates },
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
      await updateCityPlaceCount(cityName, coordinateResult.coordinates, 1);
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

    const { lat, lng, latitude, longitude, location, visibility, ...rest } = req.body;
    Object.assign(place, rest);
    if (req.user.role === 'admin' && ['public', 'private'].includes(visibility)) {
      place.visibility = visibility;
    }
    if (
      lat !== undefined ||
      lng !== undefined ||
      latitude !== undefined ||
      longitude !== undefined ||
      location?.coordinates
    ) {
      const coordinateResult = getCoordinatesFromBody(req.body);
      if (coordinateResult.error) return res.status(400).json({ message: coordinateResult.error });
      place.location = { type: 'Point', coordinates: coordinateResult.coordinates };
    }

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

    if (place.visibility === 'public') await updateCityPlaceCount(place.city, null, -1);
    await place.deleteOne();
    res.json({ message: 'Place deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPlaces, getPlace, createPlace, updatePlace, deletePlace };
