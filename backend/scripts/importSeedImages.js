require('dotenv').config();

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const mongoose = require('mongoose');
const Place = require('../models/Place');
const { isUsablePlaceImage } = require('../utils/placeImages');

const applyChanges = process.argv.includes('--apply');
const overwrite = process.argv.includes('--overwrite');
const cityArg = process.argv.find(arg => arg.startsWith('--city='));
const cityFilter = cityArg ? cityArg.slice('--city='.length).trim() : '';

const seedPath = path.join(__dirname, '..', 'seed.js');

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractSeedPlaces = () => {
  const source = fs.readFileSync(seedPath, 'utf8');
  const startToken = 'const places =';
  const endToken = 'const seedDB';
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate places array in seed.js');
  }

  const assignment = source.slice(start + startToken.length, end).trim();
  const arraySource = assignment.replace(/;\s*$/, '');
  return vm.runInNewContext(`(${arraySource})`, {}, { timeout: 1000 });
};

const hasUsableImage = place =>
  Array.isArray(place?.images) && place.images.some(isUsablePlaceImage);

const getUsableSeedImages = place =>
  (Array.isArray(place?.images) ? place.images : []).filter(isUsablePlaceImage);

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');

  const seedPlaces = extractSeedPlaces()
    .filter(place => !cityFilter || String(place.city || '').toLocaleLowerCase('tr-TR') === cityFilter.toLocaleLowerCase('tr-TR'));

  await mongoose.connect(process.env.MONGO_URI);

  const stats = {
    seedPlaces: seedPlaces.length,
    seedPlacesWithImages: 0,
    matchedDocuments: 0,
    proposedUpdates: 0,
    updated: 0,
    skippedExisting: 0,
    missingDocuments: 0,
    invalidSeedImages: 0,
  };

  for (const seedPlace of seedPlaces) {
    const seedImages = getUsableSeedImages(seedPlace);
    const rawImageCount = Array.isArray(seedPlace.images) ? seedPlace.images.length : 0;

    if (rawImageCount > 0 && seedImages.length === 0) {
      stats.invalidSeedImages++;
      console.log(`[SKIP:INVALID] ${seedPlace.name} (${seedPlace.city})`);
      continue;
    }

    if (!seedImages.length) continue;
    stats.seedPlacesWithImages++;

    const matches = await Place.find({
      city: seedPlace.city,
      name: seedPlace.name,
    });

    if (!matches.length) {
      stats.missingDocuments++;
      console.log(`[MISS] ${seedPlace.name} (${seedPlace.city})`);
      continue;
    }

    stats.matchedDocuments += matches.length;

    for (const place of matches) {
      if (!overwrite && hasUsableImage(place)) {
        stats.skippedExisting++;
        console.log(`[SKIP:EXISTS] ${place.name} (${place.city})`);
        continue;
      }

      stats.proposedUpdates++;
      console.log(`[${applyChanges ? 'APPLY' : 'DRY'}:IMPORT] ${place.name} (${place.city})`);
      console.log(`  images: ${seedImages.join(', ')}`);

      if (applyChanges) {
        place.images = seedImages;
        await place.save();
        stats.updated++;
      }
    }
  }

  console.log('');
  console.log(`${applyChanges ? 'Updated' : 'Would update'} ${applyChanges ? stats.updated : stats.proposedUpdates} documents.`);
  console.log(`  seed places scanned: ${stats.seedPlaces}`);
  console.log(`  seed places with images: ${stats.seedPlacesWithImages}`);
  console.log(`  matched documents: ${stats.matchedDocuments}`);
  console.log(`  skipped existing images: ${stats.skippedExisting}`);
  console.log(`  missing documents: ${stats.missingDocuments}`);
  console.log(`  invalid seed image entries: ${stats.invalidSeedImages}`);

  if (cityFilter) {
    const remainingMissing = await Place.countDocuments({
      city: { $regex: `^${escapeRegExp(cityFilter)}$`, $options: 'i' },
      $or: [
        { images: { $exists: false } },
        { images: { $size: 0 } },
      ],
    });
    console.log(`  remaining empty-image documents in ${cityFilter}: ${remainingMissing}`);
  }

  await mongoose.disconnect();
};

main().catch(async err => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
