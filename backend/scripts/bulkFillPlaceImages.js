require('dotenv').config();

const mongoose = require('mongoose');
const Place = require('../models/Place');
const {
  buildWikipediaTitleCandidates,
  getFirstUsableImage,
  isExistingImageReliable,
  isCandidateReliable,
  isUsablePlaceImage,
  scoreCandidate,
} = require('../utils/placeImages');

const applyChanges = process.argv.includes('--apply');
const cityArg = process.argv.find(arg => arg.startsWith('--city='));
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const city = cityArg ? cityArg.slice('--city='.length).trim() : '';
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;

const LANGUAGES = ['tr', 'en'];
const BATCH_SIZE = 15;
const TIMEOUT_MS = 8000;
const MIN_SCORE = 28;
const normalizeText = value => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\u0131/g, 'i')
  .replace(/\u0130/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const descriptorGroups = [
  ['bridge', 'kopru', 'koprusu'],
  ['mosque', 'camii', 'camisi', 'cami'],
  ['castle', 'fortress', 'kale', 'kalesi', 'hisar'],
  ['museum', 'muze', 'muzesi', 'museum'],
  ['palace', 'saray', 'sarayi'],
  ['tomb', 'turbe', 'turbesi'],
  ['tower', 'clock', 'saat', 'kulesi'],
  ['monastery', 'manastir', 'manastiri'],
];

const genericTokens = new Set([
  'acik', 'antik', 'ancient', 'bridge', 'camii', 'camisi', 'cami', 'castle',
  'city', 'clock', 'han', 'kale', 'kalesi', 'kent', 'kenti', 'kopru',
  'koprusu', 'medrese', 'museum', 'muze', 'muzesi', 'saat', 'sarayi',
  'site', 'tower', 'turbe', 'turbesi', 'vadisi', 'yer', 'yeri',
]);

const hasDescriptorMatch = (place, text) => {
  const name = normalizeText(place?.name);
  const haystack = normalizeText(text);
  const required = descriptorGroups.filter(group => group.some(token => name.includes(token)));
  if (!required.length) return true;
  return required.some(group => group.some(token => haystack.includes(token)));
};

const hasWrongCitySignal = (place, text) => {
  const haystack = normalizeText(text);
  const city = normalizeText(place?.city);
  const wrongCities = ['diyarbakir', 'istanbul', 'ankara', 'bursa', 'edirne', 'izmir', 'konya', 'van', 'samsun', 'yalova', 'tekirdag']
    .filter(candidate => candidate !== city);
  return wrongCities.some(candidate => haystack.includes(candidate));
};

const imageText = (imageUrl = '') => {
  try {
    return normalizeText(decodeURIComponent(String(imageUrl).split('?')[0].split('/').pop() || ''));
  } catch (err) {
    return normalizeText(String(imageUrl).split('?')[0].split('/').pop() || '');
  }
};

const getNameTokens = (place) => normalizeText(place?.name)
  .split(' ')
  .filter(token => token.length >= 4 && !genericTokens.has(token));

const hasImagePlaceSignal = (place, imageUrl) => {
  const text = imageText(imageUrl);
  const city = normalizeText(place?.city);
  const tokens = getNameTokens(place);
  if (tokens.some(token => text.includes(token))) return true;
  if (city && text.includes(city) && hasDescriptorMatch(place, text)) return true;
  return false;
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const buildApiUrl = (baseUrl, params) => {
  const searchParams = new URLSearchParams(params);
  return `${baseUrl}?${searchParams.toString()}`;
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CityLore/1.0 educational project',
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const chunks = (values, size) => {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const imageFromPage = (page) => [
  page?.original?.source,
  page?.thumbnail?.source,
].find(isUsablePlaceImage) || '';

const normalizeFileTitle = (title = '') => String(title || '')
  .replace(/^(Dosya|File):/i, '')
  .trim();

const fetchPages = async (language, titles) => {
  const url = buildApiUrl(`https://${language}.wikipedia.org/w/api.php`, {
    action: 'query',
    format: 'json',
    origin: '*',
    redirects: '1',
    titles: titles.join('|'),
    prop: 'pageimages|pageprops',
    piprop: 'thumbnail|original|name',
    pithumbsize: '1280',
    ppprop: 'wikibase_item',
  });
  const data = await fetchJson(url);
  const redirectSourcesByTarget = new Map();
  for (const redirect of data?.query?.redirects || []) {
    const target = String(redirect.to || '').toLocaleLowerCase('tr-TR');
    const sources = redirectSourcesByTarget.get(target) || [];
    sources.push(redirect.from);
    redirectSourcesByTarget.set(target, sources);
  }

  return Object.values(data?.query?.pages || {})
    .filter(page => page?.title && !page.missing)
    .map(page => ({
      ...page,
      sourceTitles: [
        page.title,
        ...(redirectSourcesByTarget.get(page.title.toLocaleLowerCase('tr-TR')) || []),
      ],
    }));
};

const fetchWikidataClaims = async (ids) => {
  const claimsById = new Map();
  for (const batch of chunks([...new Set(ids)].filter(Boolean), BATCH_SIZE)) {
    const url = buildApiUrl('https://www.wikidata.org/w/api.php', {
      action: 'wbgetentities',
      format: 'json',
      origin: '*',
      ids: batch.join('|'),
      props: 'claims',
    });
    const data = await fetchJson(url);
    for (const id of batch) {
      claimsById.set(id, data?.entities?.[id]?.claims?.P18 || []);
    }
    await delay(100);
  }
  return claimsById;
};

const fetchCommonsImages = async (fileNames) => {
  const imagesByFile = new Map();
  const titles = [...new Set(fileNames.map(normalizeFileTitle).filter(Boolean))]
    .map(fileName => `File:${fileName}`);

  for (const batch of chunks(titles, BATCH_SIZE)) {
    const url = buildApiUrl('https://commons.wikimedia.org/w/api.php', {
      action: 'query',
      format: 'json',
      origin: '*',
      titles: batch.join('|'),
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '1280',
    });
    const data = await fetchJson(url);
    for (const page of Object.values(data?.query?.pages || {})) {
      const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
      const imageUrl = [imageInfo?.thumburl, imageInfo?.url].find(isUsablePlaceImage) || '';
      if (imageUrl) imagesByFile.set(normalizeFileTitle(page.title), imageUrl);
    }
    await delay(100);
  }

  return imagesByFile;
};

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI);

  const query = {};
  if (city) query.city = { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };

  const findQuery = Place.find(query).sort({ city: 1, name: 1 });
  if (Number.isFinite(limit) && limit > 0) findQuery.limit(limit);
  const places = await findQuery;

  const candidatesByTitle = new Map();
  for (const place of places) {
    const current = getFirstUsableImage(place);
    if (current && isExistingImageReliable(place, current)) continue;

    for (const title of buildWikipediaTitleCandidates(place).slice(0, 8)) {
      const key = title.toLocaleLowerCase('tr-TR');
      const bucket = candidatesByTitle.get(key) || { title, places: [] };
      bucket.places.push(place);
      candidatesByTitle.set(key, bucket);
    }
  }

  const pageCandidates = [];
  for (const language of LANGUAGES) {
    for (const batch of chunks([...candidatesByTitle.values()].map(item => item.title), BATCH_SIZE)) {
      const pages = await fetchPages(language, batch);
      for (const page of pages) {
        const matchingBuckets = page.sourceTitles
          .map(title => candidatesByTitle.get(String(title || '').toLocaleLowerCase('tr-TR')))
          .filter(Boolean);
        for (const bucket of matchingBuckets) {
          for (const place of bucket.places) {
            const imageUrl = imageFromPage(page);
            if (imageUrl) {
              pageCandidates.push({
                place,
                title: page.title,
                query: bucket.title,
                imageUrl,
                wikidataId: page.pageprops?.wikibase_item || '',
              });
            }
            if (page.pageprops?.wikibase_item) {
              pageCandidates.push({
                place,
                title: page.title,
                query: bucket.title,
                imageUrl: '',
                wikidataId: page.pageprops.wikibase_item,
              });
            }
          }
        }
      }
      await delay(100);
    }
  }

  const claimsById = await fetchWikidataClaims(pageCandidates.map(candidate => candidate.wikidataId));
  const p18Files = [];
  for (const candidate of pageCandidates) {
    for (const claim of claimsById.get(candidate.wikidataId) || []) {
      const fileName = claim?.mainsnak?.datavalue?.value;
      if (fileName) p18Files.push(fileName);
    }
  }
  const commonsImages = await fetchCommonsImages(p18Files);

  const bestByPlace = new Map();
  const consider = (candidate) => {
    if (!candidate.imageUrl) return;
    const contextText = `${candidate.title} ${candidate.imageUrl}`;
    if (!hasDescriptorMatch(candidate.place, contextText)) return;
    if (hasWrongCitySignal(candidate.place, contextText)) return;
    if (!hasImagePlaceSignal(candidate.place, candidate.imageUrl)) return;
    if (!isCandidateReliable({
      title: candidate.title,
      imageUrl: candidate.imageUrl,
      query: candidate.query,
      place: candidate.place,
    })) return;

    const score = scoreCandidate({
      title: candidate.title,
      imageUrl: candidate.imageUrl,
      query: candidate.query,
      place: candidate.place,
    });
    if (score < MIN_SCORE) return;

    const key = String(candidate.place._id);
    const previous = bestByPlace.get(key);
    if (!previous || score > previous.score) {
      bestByPlace.set(key, { ...candidate, score });
    }
  };

  for (const candidate of pageCandidates) consider(candidate);
  for (const candidate of pageCandidates) {
    for (const claim of claimsById.get(candidate.wikidataId) || []) {
      const fileName = claim?.mainsnak?.datavalue?.value;
      const imageUrl = commonsImages.get(normalizeFileTitle(fileName));
      consider({
        ...candidate,
        title: `${candidate.title} ${fileName}`,
        imageUrl,
      });
    }
  }

  let updated = 0;
  for (const candidate of [...bestByPlace.values()].sort((a, b) =>
    `${a.place.city} ${a.place.name}`.localeCompare(`${b.place.city} ${b.place.name}`, 'tr')
  )) {
    console.log(`[${applyChanges ? 'APPLY' : 'DRY'}:FILL] ${candidate.place.name} (${candidate.place.city})`);
    console.log(`  score (${candidate.score}): ${candidate.imageUrl}`);
    if (applyChanges) {
      candidate.place.images = [candidate.imageUrl];
      await candidate.place.save();
      updated++;
    }
  }

  console.log('');
  console.log(`${applyChanges ? 'Updated' : 'Would update'} ${applyChanges ? updated : bestByPlace.size} of ${places.length} places.`);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
