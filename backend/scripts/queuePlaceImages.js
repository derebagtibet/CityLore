require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Place = require('../models/Place');
const {
  buildPlaceImageQueries,
  buildWikipediaTitleCandidates,
  getFirstUsableImage,
  isCandidateReliable,
  isUsablePlaceImage,
  scoreCandidate,
} = require('../utils/placeImages');

const LANGUAGES = ['tr', 'en'];
const MAX_TITLES = 5;
const MAX_QUERIES = 8;
const MAX_ROWS_PER_PLACE = 5;
const SEARCH_LIMIT = 5;
const TIMEOUT_MS = 8000;
const FETCH_RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const MAX_RETRY_AFTER_MS = 5000;
const STRONG_SCORE = 80;
const REVIEW_SCORE = 18;
const DEFAULT_REPORT_PATH = path.join(__dirname, '..', 'image-review-queue.json');

const args = process.argv.slice(2);
const applyApproved = args.includes('--apply-approved');
const overwrite = args.includes('--overwrite');
const missingOnly = args.includes('--missing-only');
const trustedOnly = args.includes('--trusted-only');
const cityArg = args.find(arg => arg.startsWith('--city='));
const limitArg = args.find(arg => arg.startsWith('--limit='));
const outputArg = args.find(arg => arg.startsWith('--output='));
const inputArg = args.find(arg => arg.startsWith('--input='));
const city = cityArg ? cityArg.slice('--city='.length).trim() : '';
const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;
const reportPath = path.resolve(outputArg ? outputArg.slice('--output='.length) : DEFAULT_REPORT_PATH);
const inputPath = path.resolve(inputArg ? inputArg.slice('--input='.length) : reportPath);

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
  ['museum', 'muze', 'muzesi'],
  ['ship', 'gemi', 'vapur', 'vapuru'],
  ['palace', 'saray', 'sarayi'],
  ['tomb', 'turbe', 'turbesi'],
  ['tower', 'clock', 'saat', 'kulesi'],
  ['monastery', 'manastir', 'manastiri'],
  ['church', 'kilise', 'kilisesi'],
  ['theatre', 'tiyatro', 'tiyatrosu'],
];

const genericTokens = new Set([
  'acik', 'antik', 'ancient', 'bridge', 'camii', 'camisi', 'cami', 'castle',
  'city', 'clock', 'han', 'kale', 'kalesi', 'kent', 'kenti', 'kopru',
  'koprusu', 'medrese', 'museum', 'muze', 'muzesi', 'oren', 'saat',
  'sarayi', 'site', 'tower', 'turbe', 'turbesi', 'vadisi', 'yer', 'yeri',
]);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const buildApiUrl = (baseUrl, params) => `${baseUrl}?${new URLSearchParams(params).toString()}`;

const fetchJson = async (url, attempt = 0) => {
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
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < FETCH_RETRIES) {
        const retryAfter = Number(response.headers?.get?.('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS)
          : RETRY_DELAY_MS * (attempt + 1);
        await delay(waitMs);
        return fetchJson(url, attempt + 1);
      }
      return null;
    }
    return response.json();
  } catch (err) {
    if (attempt < FETCH_RETRIES) {
      await delay(RETRY_DELAY_MS * (attempt + 1));
      return fetchJson(url, attempt + 1);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const imageText = (imageUrl = '') => {
  const fileName = String(imageUrl).split('?')[0].split('/').pop() || '';
  try {
    return normalizeText(decodeURIComponent(fileName));
  } catch (err) {
    return normalizeText(fileName);
  }
};

const normalizeFileTitle = (title = '') => String(title || '')
  .replace(/^(Dosya|File):/i, '')
  .trim();

const getNameTokens = place => normalizeText(place?.name)
  .split(' ')
  .filter(token => token.length >= 4 && !genericTokens.has(token));

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
  const wrongCities = [
    'adana', 'ankara', 'antalya', 'bursa', 'diyarbakir', 'edirne', 'istanbul',
    'izmir', 'kayseri', 'konya', 'samsun', 'trabzon', 'van', 'yalova',
  ].filter(candidate => candidate !== city);
  return wrongCities.some(candidate => haystack.includes(candidate));
};

const getReasonFlags = ({ place, title = '', imageUrl = '', query = '', sourceType = '' }) => {
  const haystack = normalizeText(`${title} ${query} ${imageText(imageUrl)}`);
  const imageName = imageText(imageUrl);
  const city = normalizeText(place?.city);
  const nameTokens = getNameTokens(place);
  const flags = [];

  if (nameTokens.some(token => imageName.includes(token))) flags.push('image_name_place_token');
  if (nameTokens.some(token => haystack.includes(token))) flags.push('context_place_token');
  if (city && imageName.includes(city)) flags.push('image_name_city');
  if (city && haystack.includes(city)) flags.push('context_city');
  if (hasDescriptorMatch(place, `${title} ${imageUrl}`)) flags.push('descriptor_match');
  if (sourceType.includes('exact')) flags.push('exact_page_context');
  if (sourceType.includes('article')) flags.push('article_context');
  if (hasWrongCitySignal(place, `${title} ${imageText(imageUrl)}`)) flags.push('wrong_city_signal');

  return flags;
};

const classifyCandidate = ({ place, title = '', imageUrl = '', query = '', sourceType = '' }) => {
  if (!isUsablePlaceImage(imageUrl)) {
    return { status: 'rejected', score: -100, reasonFlags: ['unusable_image'] };
  }

  const reasonFlags = getReasonFlags({ place, title, imageUrl, query, sourceType });
  const score = scoreCandidate({ title, imageUrl, query, place });
  const hasPlaceSignal = reasonFlags.includes('image_name_place_token') ||
    reasonFlags.includes('image_name_city') ||
    reasonFlags.includes('exact_page_context') ||
    reasonFlags.includes('article_context');
  const hasContext = reasonFlags.includes('context_place_token') ||
    reasonFlags.includes('context_city') ||
    reasonFlags.includes('descriptor_match');

  if (reasonFlags.includes('wrong_city_signal')) return { status: 'rejected', score, reasonFlags };
  if (!hasDescriptorMatch(place, `${title} ${imageUrl}`)) return { status: 'rejected', score, reasonFlags };
  if (!hasPlaceSignal || !hasContext || score < REVIEW_SCORE) return { status: 'rejected', score, reasonFlags };
  if (score >= STRONG_SCORE && isCandidateReliable({ title, imageUrl, query, place })) {
    return { status: 'strong', score, reasonFlags };
  }
  return { status: 'needs_review', score, reasonFlags };
};

const addCandidate = (candidates, candidate) => {
  const imageUrl = candidate.imageUrl;
  if (!imageUrl) return;
  const key = `${candidate.place._id || candidate.place.name}|${imageUrl}`;
  if (candidates.has(key)) return;
  candidates.set(key, candidate);
};

const imageFromPage = page => [
  page?.original?.source,
  page?.thumbnail?.source,
].find(isUsablePlaceImage) || '';

const fetchCommonsImagesForFiles = async (fileTitles) => {
  const titles = [...new Set(fileTitles.map(normalizeFileTitle).filter(Boolean))]
    .map(fileName => `File:${fileName}`);
  if (!titles.length) return [];

  const results = [];
  for (let index = 0; index < titles.length; index += 30) {
    const batch = titles.slice(index, index + 30);
    const data = await fetchJson(buildApiUrl('https://commons.wikimedia.org/w/api.php', {
      action: 'query',
      format: 'json',
      origin: '*',
      titles: batch.join('|'),
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '1280',
    }));
    for (const page of Object.values(data?.query?.pages || {})) {
      const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
      const imageUrl = [imageInfo?.thumburl, imageInfo?.url].find(isUsablePlaceImage) || '';
      if (imageUrl) results.push({ title: page.title || '', imageUrl });
    }
    await delay(100);
  }
  return results;
};

const collectExactCandidates = async (place, candidates) => {
  const titles = buildWikipediaTitleCandidates(place).slice(0, MAX_TITLES);
  for (const title of titles) {
    for (const language of LANGUAGES) {
      const summary = await fetchJson(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      const imageUrl = [summary?.originalimage?.source, summary?.thumbnail?.source].find(isUsablePlaceImage) || '';
      if (imageUrl) {
        const candidate = {
          place,
          sourceType: 'exact_summary',
          matchedTitle: summary?.title || title,
          query: title,
          imageUrl,
        };
        addCandidate(candidates, candidate);
        const classification = classifyCandidate({
          place,
          title: candidate.matchedTitle,
          imageUrl: candidate.imageUrl,
          query: candidate.query,
          sourceType: candidate.sourceType,
        });
        if (classification.status === 'strong') return true;
      }

      if (summary?.wikibase_item) {
        await collectWikidataCandidates(place, candidates, [summary.wikibase_item], summary?.title || title, title, 'exact_wikidata');
      }
      await delay(50);
    }
  }
  return false;
};

const collectArticleCandidates = async (place, candidates) => {
  const titles = buildWikipediaTitleCandidates(place).slice(0, MAX_TITLES);
  for (const title of titles) {
    for (const language of LANGUAGES) {
      const data = await fetchJson(buildApiUrl(`https://${language}.wikipedia.org/w/api.php`, {
        action: 'query',
        format: 'json',
        origin: '*',
        redirects: '1',
        titles: title,
        prop: 'images|pageprops',
        imlimit: '35',
        ppprop: 'wikibase_item',
      }));
      const pages = Object.values(data?.query?.pages || {}).filter(page => page?.title && !page.missing);
      for (const page of pages) {
        const fileTitles = (page.images || []).map(image => image.title).filter(Boolean);
        const images = await fetchCommonsImagesForFiles(fileTitles);
        for (const image of images) {
          addCandidate(candidates, {
            place,
            sourceType: 'exact_article_image',
            matchedTitle: `${page.title} ${image.title}`,
            query: title,
            imageUrl: image.imageUrl,
          });
        }
        if (page.pageprops?.wikibase_item) {
          await collectWikidataCandidates(place, candidates, [page.pageprops.wikibase_item], page.title, title, 'article_wikidata');
        }
      }
      await delay(100);
    }
  }
};

const collectWikidataCandidates = async (place, candidates, ids, contextTitle, query, sourceType) => {
  const cleanIds = [...new Set(ids.filter(Boolean))];
  if (!cleanIds.length) return;
  const data = await fetchJson(buildApiUrl('https://www.wikidata.org/w/api.php', {
    action: 'wbgetentities',
    format: 'json',
    origin: '*',
    ids: cleanIds.join('|'),
    props: 'claims',
  }));
  const fileTitles = [];
  for (const id of cleanIds) {
    const claims = data?.entities?.[id]?.claims?.P18 || [];
    for (const claim of claims) {
      const fileName = claim?.mainsnak?.datavalue?.value;
      if (fileName) fileTitles.push(fileName);
    }
  }
  const images = await fetchCommonsImagesForFiles(fileTitles);
  for (const image of images) {
    addCandidate(candidates, {
      place,
      sourceType,
      matchedTitle: `${contextTitle} ${image.title}`,
      query,
      imageUrl: image.imageUrl,
    });
  }
};

const collectSearchCandidates = async (place, candidates) => {
  const queries = buildPlaceImageQueries(place).slice(0, MAX_QUERIES);
  for (const query of queries) {
    for (const language of LANGUAGES) {
      const data = await fetchJson(buildApiUrl(`https://${language}.wikipedia.org/w/api.php`, {
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrsearch: query,
        gsrnamespace: '0',
        gsrlimit: String(SEARCH_LIMIT),
        prop: 'pageimages|pageprops',
        piprop: 'thumbnail|original|name',
        pithumbsize: '1280',
        ppprop: 'wikibase_item',
      }));
      const pages = Object.values(data?.query?.pages || {});
      for (const page of pages) {
        const imageUrl = imageFromPage(page);
        if (imageUrl) {
          addCandidate(candidates, {
            place,
            sourceType: 'wiki_search_pageimage',
            matchedTitle: page.title || '',
            query,
            imageUrl,
          });
        }
        if (page.pageprops?.wikibase_item) {
          await collectWikidataCandidates(place, candidates, [page.pageprops.wikibase_item], page.title || '', query, 'wiki_search_wikidata');
        }
      }
      await delay(100);
    }
  }
};

const collectCommonsCandidates = async (place, candidates) => {
  const queries = buildPlaceImageQueries(place).slice(0, MAX_QUERIES);
  for (const query of queries) {
    for (const generator of ['prefixsearch', 'search']) {
      const data = await fetchJson(buildApiUrl('https://commons.wikimedia.org/w/api.php', {
        action: 'query',
        format: 'json',
        origin: '*',
        generator,
        [generator === 'prefixsearch' ? 'gpssearch' : 'gsrsearch']: query,
        [generator === 'prefixsearch' ? 'gpsnamespace' : 'gsrnamespace']: '6',
        [generator === 'prefixsearch' ? 'gpslimit' : 'gsrlimit']: String(SEARCH_LIMIT),
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '1280',
      }));
      for (const page of Object.values(data?.query?.pages || {})) {
        const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
        const imageUrl = [imageInfo?.thumburl, imageInfo?.url].find(isUsablePlaceImage) || '';
        if (imageUrl) {
          addCandidate(candidates, {
            place,
            sourceType: `commons_${generator}`,
            matchedTitle: page.title || '',
            query,
            imageUrl,
          });
        }
      }
      await delay(100);
    }
  }
};

const rowsFromCandidates = (place, candidates) => {
  return [...candidates.values()]
    .map(candidate => {
      const classification = classifyCandidate({
        place,
        title: candidate.matchedTitle,
        imageUrl: candidate.imageUrl,
        query: candidate.query,
        sourceType: candidate.sourceType,
      });
      return {
        approved: false,
        status: classification.status,
        city: place.city || '',
        name: place.name || '',
        category: place.category || '',
        currentImage: getFirstUsableImage(place),
        candidateUrl: candidate.imageUrl,
        score: classification.score,
        sourceType: candidate.sourceType,
        matchedTitle: candidate.matchedTitle,
        query: candidate.query,
        reasonFlags: classification.reasonFlags,
      };
    })
    .filter(row => row.status !== 'rejected')
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ROWS_PER_PLACE);
};

const hasStrongRows = rows => rows.some(row => row.status === 'strong');

const buildRowsForPlace = async (place) => {
  const candidates = new Map();

  const hasStrongExact = await collectExactCandidates(place, candidates);
  let rows = rowsFromCandidates(place, candidates);
  if (hasStrongExact || hasStrongRows(rows)) return rows;

  await collectArticleCandidates(place, candidates);
  rows = rowsFromCandidates(place, candidates);
  if (trustedOnly) return rows;
  if (hasStrongRows(rows)) return rows;

  await collectSearchCandidates(place, candidates);
  rows = rowsFromCandidates(place, candidates);
  if (hasStrongRows(rows)) return rows;

  await collectCommonsCandidates(place, candidates);
  return rowsFromCandidates(place, candidates);
};

const generateReport = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI);

  const query = {};
  if (city) query.city = { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
  const findQuery = Place.find(query).sort({ city: 1, name: 1 });
  if (Number.isFinite(limit) && limit > 0) findQuery.limit(limit);
  let places = await findQuery;
  if (missingOnly) places = places.filter(place => !getFirstUsableImage(place));

  const rows = [];
  for (const place of places) {
    const placeRows = await buildRowsForPlace(place);
    rows.push(...placeRows);
    console.log(`[QUEUE] ${place.name} (${place.city}) -> ${placeRows.length} candidates`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    filters: { city, limit, missingOnly, trustedOnly },
    summary: {
      placesScanned: places.length,
      rows: rows.length,
      strong: rows.filter(row => row.status === 'strong').length,
      needsReview: rows.filter(row => row.status === 'needs_review').length,
    },
    rows,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await mongoose.disconnect();

  console.log('');
  console.log(`Wrote ${rows.length} candidate rows to ${reportPath}`);
  console.log(`  strong: ${report.summary.strong}`);
  console.log(`  needs_review: ${report.summary.needsReview}`);
};

const applyApprovedRows = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const approvedRows = (report.rows || []).filter(row => row.approved === true && isUsablePlaceImage(row.candidateUrl));

  await mongoose.connect(process.env.MONGO_URI);
  let updated = 0;
  let skippedExisting = 0;
  let missingDocuments = 0;

  for (const row of approvedRows) {
    const places = await Place.find({ city: row.city, name: row.name });
    if (!places.length) {
      missingDocuments++;
      console.log(`[MISS] ${row.name} (${row.city})`);
      continue;
    }

    for (const place of places) {
      if (!overwrite && getFirstUsableImage(place)) {
        skippedExisting++;
        console.log(`[SKIP:EXISTS] ${place.name} (${place.city})`);
        continue;
      }

      place.images = [row.candidateUrl];
      await place.save();
      updated++;
      console.log(`[APPLY:APPROVED] ${place.name} (${place.city})`);
      console.log(`  image: ${row.candidateUrl}`);
    }
  }

  await mongoose.disconnect();
  console.log('');
  console.log(`Applied ${updated} approved image rows.`);
  console.log(`  approved rows: ${approvedRows.length}`);
  console.log(`  skipped existing images: ${skippedExisting}`);
  console.log(`  missing documents: ${missingDocuments}`);
};

if (require.main === module) {
  (applyApproved ? applyApprovedRows() : generateReport()).catch(async err => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = {
  classifyCandidate,
  getReasonFlags,
  buildRowsForPlace,
};
