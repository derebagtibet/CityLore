require('dotenv').config();

const mongoose = require('mongoose');
const Place = require('../models/Place');
const {
  resolvePlaceImage,
  isExistingImageReliable,
  shouldReplacePlaceImage,
  getFirstUsableImage,
  scoreCandidate,
  clearImageCache,
} = require('../utils/placeImages');

const applyChanges = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;

const formatScore = (place, imageUrl) => scoreCandidate({ imageUrl, place });

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const query = { images: { $exists: true, $ne: [] } };
  const findQuery = Place.find(query).sort({ city: 1, name: 1 });
  if (Number.isFinite(limit) && limit > 0) findQuery.limit(limit);

  const places = await findQuery;
  const changes = [];
  const stats = new Map();

  for (const place of places) {
    const currentImage = getFirstUsableImage(place);
    if (!currentImage || isExistingImageReliable(place, currentImage)) continue;

    clearImageCache();
    const nextImage = await resolvePlaceImage(place, { ignoreExisting: true });
    if (!shouldReplacePlaceImage(place, currentImage, nextImage)) continue;

    const change = {
      id: place._id.toString(),
      name: place.name,
      city: place.city,
      category: place.category,
      oldImage: currentImage,
      newImage: nextImage,
      oldScore: formatScore(place, currentImage),
      newScore: formatScore(place, nextImage),
    };
    changes.push(change);

    const key = `${place.city || 'Unknown'} / ${place.category || 'unknown'}`;
    stats.set(key, (stats.get(key) || 0) + 1);

    console.log(`[${applyChanges ? 'APPLY' : 'DRY'}] ${change.name} (${change.city})`);
    console.log(`  old (${change.oldScore}): ${change.oldImage}`);
    console.log(`  new (${change.newScore}): ${change.newImage}`);

    if (applyChanges) {
      place.images = [nextImage];
      await place.save();
    }
  }

  console.log('');
  console.log(`${applyChanges ? 'Updated' : 'Would update'} ${changes.length} of ${places.length} places.`);
  for (const [key, count] of [...stats.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))) {
    console.log(`  ${key}: ${count}`);
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
