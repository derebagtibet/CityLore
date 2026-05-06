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
const cityArg = process.argv.find(arg => arg.startsWith('--city='));
const delayArg = process.argv.find(arg => arg.startsWith('--delay='));
const exhaustive = process.argv.includes('--exhaustive');
const searchFallbacks = process.argv.includes('--search');
const articleFallbacks = process.argv.includes('--article');
const clearSuspicious = process.argv.includes('--clear-suspicious');
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;
const city = cityArg ? cityArg.slice('--city='.length).trim() : '';
const REQUEST_DELAY_MS = delayArg ? Number(delayArg.split('=')[1]) : 1500;
const resolverOptions = exhaustive
  ? { ignoreExisting: true }
  : {
      ignoreExisting: true,
      exactOnly: !searchFallbacks,
      skipArticleImages: !articleFallbacks,
      maxTitleCandidates: 2,
      maxQueries: searchFallbacks ? 8 : 0,
      maxCommonsQueries: searchFallbacks ? 2 : 0,
    };

if (!exhaustive) {
  process.env.CITYLORE_IMAGE_TIMEOUT_MS = process.env.CITYLORE_IMAGE_TIMEOUT_MS || '2000';
  process.env.CITYLORE_IMAGE_RETRIES = process.env.CITYLORE_IMAGE_RETRIES || '0';
}

const formatScore = (place, imageUrl) => scoreCandidate({ imageUrl, place });
const countBy = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isResolvedCandidate = (place, imageUrl) => {
  if (!imageUrl) return false;
  return shouldReplacePlaceImage(place, '', imageUrl);
};

const analyzePlace = async (place) => {
  const currentImage = getFirstUsableImage(place);
  const hasReliableImage = currentImage && isExistingImageReliable(place, currentImage);
  if (hasReliableImage) {
    return { status: 'reliable', currentImage };
  }

  clearImageCache();
  const nextImage = await resolvePlaceImage(place, resolverOptions);
  const shouldUpdate = currentImage
    ? shouldReplacePlaceImage(place, currentImage, nextImage)
    : isResolvedCandidate(place, nextImage);

  if (!shouldUpdate) {
    if (currentImage) {
      return {
        status: clearSuspicious ? 'suspicious-clear' : 'suspicious-unresolved',
        currentImage,
        nextImage,
        oldScore: formatScore(place, currentImage),
      };
    }

    return {
      status: 'missing-unresolved',
      currentImage,
      nextImage,
    };
  }

  return {
    status: currentImage ? 'suspicious-resolved' : 'missing-resolved',
    currentImage,
    nextImage,
    oldScore: currentImage ? formatScore(place, currentImage) : null,
    newScore: formatScore(place, nextImage),
  };
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const query = {};
  if (city) query.city = { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };

  const findQuery = Place.find(query).sort({ city: 1, name: 1 });
  if (Number.isFinite(limit) && limit > 0) findQuery.limit(limit);

  const places = await findQuery;
  const stats = {
    scanned: places.length,
    reliable: 0,
    missing: 0,
    suspicious: 0,
    resolved: 0,
    unresolved: 0,
    cleared: 0,
    updated: 0,
  };
  const groupedChanges = new Map();

  for (const place of places) {
    const result = await analyzePlace(place);
    if (Number.isFinite(REQUEST_DELAY_MS) && REQUEST_DELAY_MS > 0) {
      await delay(REQUEST_DELAY_MS);
    }

    if (result.status === 'reliable') {
      stats.reliable++;
      continue;
    }

    if (result.status.startsWith('missing')) stats.missing++;
    if (result.status.startsWith('suspicious')) stats.suspicious++;

    if (result.status.endsWith('unresolved')) {
      stats.unresolved++;
      continue;
    }

    const shouldClear = result.status === 'suspicious-clear';
    if (!shouldClear) stats.resolved++;
    else stats.cleared++;
    const label = shouldClear ? 'CLEAR' : (result.status.startsWith('missing') ? 'FILL' : 'REPAIR');
    const key = `${place.city || 'Unknown'} / ${place.category || 'unknown'}`;
    countBy(groupedChanges, key);

    console.log(`[${applyChanges ? 'APPLY' : 'DRY'}:${label}] ${place.name} (${place.city})`);
    if (result.currentImage) console.log(`  old (${result.oldScore}): ${result.currentImage}`);
    else console.log('  old: <missing>');
    if (shouldClear) console.log('  new: <cleared>');
    else console.log(`  new (${result.newScore}): ${result.nextImage}`);

    if (applyChanges) {
      place.images = shouldClear ? [] : [result.nextImage];
      await place.save();
      stats.updated++;
    }
  }

  console.log('');
  console.log(`${applyChanges ? 'Updated' : 'Would update'} ${applyChanges ? stats.updated : stats.resolved + stats.cleared} of ${stats.scanned} places.`);
  console.log(`  reliable: ${stats.reliable}`);
  console.log(`  missing: ${stats.missing}`);
  console.log(`  suspicious: ${stats.suspicious}`);
  console.log(`  resolved: ${stats.resolved}`);
  console.log(`  unresolved: ${stats.unresolved}`);
  console.log(`  cleared: ${stats.cleared}`);
  for (const [key, count] of [...groupedChanges.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))) {
    console.log(`  ${key}: ${count}`);
  }

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
