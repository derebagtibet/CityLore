const imageCache = new Map();

const IMAGE_TIMEOUT_MS = 3500;
const WIKIPEDIA_LANGUAGES = ['tr', 'en'];
const MAX_SEARCH_RESULTS = 6;
const USER_AGENT = 'CityLore/1.0 educational project';
const RELIABLE_IMAGE_SCORE = 28;
const REPLACEMENT_MARGIN = 18;
const BAD_IMAGE_WORDS = [
  'badge',
  'blank',
  'coat_of_arms',
  'diagram',
  'emblem',
  'flag',
  'icon',
  'logo',
  'map',
  'non_political',
  'placeholder',
  'political',
  'seal',
  'symbol',
  'wordmark',
];

const GENERIC_PLACE_WORDS = new Set([
  'acik',
  'antik',
  'camii',
  'camisi',
  'cami',
  'dag',
  'dagi',
  'hava',
  'kent',
  'kenti',
  'kale',
  'kalesi',
  'kilise',
  'kilisesi',
  'koyu',
  'manastir',
  'manastiri',
  'medrese',
  'medresesi',
  'muze',
  'muzesi',
  'oren',
  'sarayi',
  'sehir',
  'sehri',
  'tapinagi',
  'tepe',
  'tepesi',
  'vadisi',
  'yeralti',
  'yer',
  'yeri',
]);

const GENERIC_TITLE_SUFFIXES = [
  ' antik kenti',
  ' antik kent',
  ' oren yeri',
  ' acik hava muzesi',
  ' yeralti sehri',
  ' yeraltı sehri',
  ' yeraltı şehri',
  ' kalesi',
  ' camii',
  ' camisi',
  ' muzesi',
  ' müzesi',
  ' manastiri',
  ' manastırı',
];

const GENERIC_IMAGE_HINTS = [
  'aerial',
  'bay',
  'beach',
  'city',
  'harbor',
  'harbour',
  'landscape',
  'location',
  'marina',
  'panorama',
  'square',
  'street',
  'sunset',
  'town',
  'view',
];

const NAME_PHRASE_VARIANTS = [
  ['saat kulesi', 'clock tower'],
  ['antik kenti', 'ancient city'],
  ['antik kent', 'ancient city'],
  ['oren yeri', 'archaeological site'],
  ['acik hava muzesi', 'open air museum'],
  ['kalesi', 'castle'],
  ['camii', 'mosque'],
  ['camisi', 'mosque'],
  ['muzesi', 'museum'],
  ['müzesi', 'museum'],
  ['manastiri', 'monastery'],
  ['manastırı', 'monastery'],
  ['tapinagi', 'temple'],
  ['tapınağı', 'temple'],
];

const knownImageTitles = {
  anitkabir: 'Anitkabir',
  ayasofya: 'Hagia Sophia',
  'blue mosque': 'Sultan Ahmed Mosque',
  'bodrum kalesi': 'Bodrum Kalesi',
  'bandirma gemi muzesi': 'Bandirma Vapuru',
  'bandirma vapuru': 'Bandirma Vapuru',
  'cifte minareli medrese': 'Cifte Minareli Medrese Erzurum',
  'deyrulzafaran manastiri': 'Deyrulzaferan Manastiri',
  'deyrulzaferan manastiri': 'Deyrulzaferan Manastiri',
  'efes antik kenti': 'Ephesus',
  'ephesus ancient city': 'Ephesus',
  'galata kulesi': 'Galata Tower',
  'galata tower': 'Galata Tower',
  gobeklitepe: 'Gobekli Tepe',
  'gobekli tepe': 'Gobekli Tepe',
  'hagia sophia': 'Hagia Sophia',
  'kyzikos antik kenti': 'Kyzikos',
  kyzikos: 'Kyzikos',
  kizikos: 'Kizikos',
  cyzicus: 'Cyzicus',
  'mevlana museum': 'Mevlana Museum',
  'mevlana muzesi': 'Mevlana Museum',
  'mount nemrut': 'Mount Nemrut',
  'nemrut dagi': 'Mount Nemrut',
  safranbolu: 'Safranbolu',
  'sultanahmet camii': 'Sultan Ahmed Mosque',
  'sumela manastiri': 'Sumela Monastery',
  'sumela monastery': 'Sumela Monastery',
  'topkapi palace': 'Topkapi Palace',
  'topkapi sarayi': 'Topkapi Palace',
  'troya antik kenti': 'Troy',
  'troy ancient city': 'Troy',
  zeugma: 'Zeugma',
};

const normalizeText = value => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\u0131/g, 'i')
  .replace(/\u0130/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const decodeSafe = (value = '') => {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
};

const getImageText = (url = '') => {
  const cleanUrl = decodeSafe(String(url).split('?')[0]);
  return normalizeText(cleanUrl.split('/').pop() || cleanUrl);
};

const isWikimediaImage = (url = '') => /(^https?:\/\/)?upload\.wikimedia\.org\//i.test(url);

const isUsablePlaceImage = (url = '') => {
  if (!/^https?:\/\//i.test(url)) return false;

  const cleanUrl = url.split('?')[0];
  if (/\.(svg|gif|webm|mp4|ogg|ogv)$/i.test(cleanUrl)) return false;

  const decoded = decodeSafe(cleanUrl).toLowerCase();
  if (/\.svg(?:[./]|$)/i.test(decoded)) return false;
  if (!/\.(jpe?g|png|webp)$/i.test(decoded)) return false;
  if (BAD_IMAGE_WORDS.some(word => decoded.includes(word))) return false;

  return true;
};

const addUnique = (values, value) => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue) return;

  const key = cleanValue.toLocaleLowerCase('tr-TR');
  if (!normalizeText(cleanValue) || values.some(item => item.toLocaleLowerCase('tr-TR') === key)) return;
  values.push(cleanValue);
};

const withoutParentheses = value => String(value || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();

const getAddressParts = (address = '') => String(address)
  .split(/[\/,]/)
  .map(part => part.trim())
  .filter(part => part && !/^\d+$/.test(part));

const removeGenericTitleSuffixes = (value) => {
  const source = String(value || '').trim();
  const normalized = normalizeText(source);
  const results = [];

  for (const suffix of GENERIC_TITLE_SUFFIXES) {
    const normalizedSuffix = normalizeText(suffix);
    if (!normalized.endsWith(normalizedSuffix)) continue;

    const shortened = normalized.slice(0, -normalizedSuffix.length).trim();
    if (shortened.length >= 4 && shortened.split(' ').length <= 4) {
      addUnique(results, shortened);
    }
  }

  return results;
};

const getNameVariants = (name = '') => {
  const variants = [];
  const baseName = String(name || '').trim();
  const noParentheses = withoutParentheses(baseName);
  const normalized = normalizeText(baseName);

  addUnique(variants, baseName);
  addUnique(variants, noParentheses);
  addUnique(variants, normalized);
  for (const shortened of removeGenericTitleSuffixes(baseName)) {
    addUnique(variants, shortened);
  }

  for (const [from, to] of NAME_PHRASE_VARIANTS) {
    const fromRegex = new RegExp(`\\b${from}\\b`, 'i');
    if (fromRegex.test(normalized)) {
      addUnique(variants, normalized.replace(fromRegex, to));
    }
  }

  // Transliteration variants for common ancient-site spellings.
  for (const variant of [...variants]) {
    const key = normalizeText(variant);
    if (key.includes('kyzikos')) {
      addUnique(variants, variant.replace(/kyzikos/i, 'Kizikos'));
      addUnique(variants, variant.replace(/kyzikos/i, 'Cyzicus'));
    }
    if (key.includes('kizikos')) {
      addUnique(variants, variant.replace(/kizikos/i, 'Kyzikos'));
      addUnique(variants, variant.replace(/kizikos/i, 'Cyzicus'));
    }
    if (key.includes('zafaran')) {
      addUnique(variants, variant.replace(/zafaran/i, 'zaferan'));
    }
    if (key.includes('zaferan')) {
      addUnique(variants, variant.replace(/zaferan/i, 'zafaran'));
    }
  }

  return variants;
};

const getSignificantTokens = (place) => {
  const cityTokens = new Set(normalizeText(place?.city).split(' ').filter(Boolean));
  const addressTokens = new Set(normalizeText(place?.address).split(' ').filter(Boolean));
  const tokens = new Set();

  for (const variant of getNameVariants(place?.name)) {
    for (const token of normalizeText(variant).split(' ')) {
      if (token.length < 3) continue;
      if (GENERIC_PLACE_WORDS.has(token)) continue;
      if (cityTokens.has(token)) continue;
      if (addressTokens.has(token)) continue;
      tokens.add(token);
    }
  }

  return [...tokens];
};

const buildPlaceImageQueries = (place) => {
  const name = String(place?.name || '').trim();
  const city = String(place?.city || '').trim();
  const addressParts = getAddressParts(place?.address);
  const normalizedCity = normalizeText(city);
  const queries = [];

  addUnique(queries, knownImageTitles[normalizeText(name)]);
  for (const variant of getNameVariants(name)) {
    addUnique(queries, variant);
  }

  if (city) {
    for (const variant of getNameVariants(name)) {
      addUnique(queries, `${variant} ${city}`);
    }
  }

  for (const part of addressParts.slice(0, 3)) {
    if (normalizeText(part) !== normalizedCity) {
      for (const variant of getNameVariants(name).slice(0, 3)) {
        addUnique(queries, `${variant} ${part}`);
      }
    }
  }

  for (const variant of getNameVariants(name).slice(0, 3)) {
    addUnique(queries, `${variant} Turkey`);
    addUnique(queries, `${variant} Turkiye`);
    addUnique(queries, `${variant} Turkiye`);
  }

  return queries;
};

const buildWikipediaTitleCandidates = (place) => {
  const titles = [];
  addUnique(titles, knownImageTitles[normalizeText(place?.name)]);
  for (const variant of getNameVariants(place?.name)) {
    addUnique(titles, variant);
  }
  return titles;
};

const getCandidateConfidence = ({ title = '', imageUrl = '', query = '', place }) => {
  if (imageUrl && !isUsablePlaceImage(imageUrl)) return { score: -100, tokenHits: 0 };

  const significantTokens = getSignificantTokens(place);
  const haystack = normalizeText(`${title} ${getImageText(imageUrl)}`);
  const queryText = normalizeText(query);
  const city = normalizeText(place?.city);
  const addressTokens = normalizeText(place?.address).split(' ').filter(token => token.length > 3);
  const nameVariants = getNameVariants(place?.name).map(normalizeText).filter(Boolean);
  const exactNameMatch = nameVariants.some(variant => variant && haystack.includes(variant));
  const tokenHits = significantTokens.filter(token => haystack.includes(token));
  let score = 0;

  if (exactNameMatch) score += 70;
  score += tokenHits.length * 28;
  if (tokenHits.length >= Math.min(2, significantTokens.length)) score += 20;
  if (city && haystack.includes(city) && tokenHits.length > 0) score += 8;
  if (addressTokens.some(token => haystack.includes(token)) && tokenHits.length > 0) score += 5;
  if (queryText && haystack.includes(queryText) && tokenHits.length > 0) score += 8;
  if (isWikimediaImage(imageUrl)) score += 4;

  if (tokenHits.length === 0) score -= 85;
  if (city && haystack.includes(city) && tokenHits.length === 0) score -= 45;
  if (GENERIC_IMAGE_HINTS.some(word => haystack.includes(word)) && tokenHits.length === 0) score -= 35;
  if (/\b(location|locator|adm|relief|karte|harita)\b/.test(haystack)) score -= 40;

  return { score, tokenHits: tokenHits.length, exactNameMatch };
};

const scoreCandidate = ({ title = '', imageUrl = '', query = '', place }) =>
  getCandidateConfidence({ title, imageUrl, query, place }).score;

const isExistingImageReliable = (place, imageUrl) => {
  if (!isUsablePlaceImage(imageUrl)) return false;
  if (!isWikimediaImage(imageUrl)) return true;

  const confidence = getCandidateConfidence({ title: '', imageUrl, place });
  return confidence.score >= RELIABLE_IMAGE_SCORE && confidence.tokenHits > 0;
};

const getBestExistingImage = (place) => {
  const images = Array.isArray(place?.images) ? place.images : [];
  return images.find(image => isExistingImageReliable(place, image)) || '';
};

const getFirstUsableImage = (place) => {
  const images = Array.isArray(place?.images) ? place.images : [];
  return images.find(isUsablePlaceImage) || '';
};

const shouldReplacePlaceImage = (place, currentImage, nextImage) => {
  if (!nextImage || !isUsablePlaceImage(nextImage)) return false;
  if (!currentImage || !isUsablePlaceImage(currentImage)) return true;
  if (isExistingImageReliable(place, currentImage)) return false;

  const currentScore = scoreCandidate({ imageUrl: currentImage, place });
  const nextScore = scoreCandidate({ imageUrl: nextImage, place });
  return nextScore >= RELIABLE_IMAGE_SCORE && nextScore >= currentScore + REPLACEMENT_MARGIN;
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
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

const buildApiUrl = (baseUrl, params) => {
  const searchParams = new URLSearchParams(params);
  return `${baseUrl}?${searchParams.toString()}`;
};

const imageFromPage = (page) => [
  page?.original?.source,
  page?.thumbnail?.source,
].find(isUsablePlaceImage) || '';

const fetchWikipediaSummaryImage = async (language, title) => {
  const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  const candidates = [
    data?.originalimage?.source,
    data?.thumbnail?.source,
  ].filter(Boolean);

  return candidates.find(isUsablePlaceImage) || '';
};

const fetchWikipediaSearchCandidates = async (language, query, place) => {
  const url = buildApiUrl(`https://${language}.wikipedia.org/w/api.php`, {
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '0',
    gsrlimit: String(MAX_SEARCH_RESULTS),
    prop: 'pageimages|pageprops',
    piprop: 'thumbnail|original|name',
    pithumbsize: '1000',
    ppprop: 'wikibase_item',
  });
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});

  return pages
    .map(page => {
      const imageUrl = imageFromPage(page);
      return {
        title: page.title || '',
        imageUrl,
        wikidataId: page.pageprops?.wikibase_item || '',
        query,
        score: scoreCandidate({ title: page.title, imageUrl, query, place }),
      };
    })
    .sort((a, b) => b.score - a.score);
};

const fetchCommonsImageForFile = async (fileName) => {
  if (!fileName) return '';
  const title = fileName.startsWith('File:') ? fileName : `File:${fileName}`;
  const url = buildApiUrl('https://commons.wikimedia.org/w/api.php', {
    action: 'query',
    format: 'json',
    origin: '*',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '1200',
  });
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});
  const imageInfo = pages.find(page => Array.isArray(page.imageinfo))?.imageinfo?.[0];
  const candidates = [
    imageInfo?.thumburl,
    imageInfo?.url,
  ].filter(Boolean);

  return candidates.find(isUsablePlaceImage) || '';
};

const fetchWikidataP18Image = async (wikidataId, place) => {
  if (!wikidataId) return '';
  const url = buildApiUrl('https://www.wikidata.org/w/api.php', {
    action: 'wbgetentities',
    format: 'json',
    origin: '*',
    ids: wikidataId,
    props: 'claims',
  });
  const data = await fetchJson(url);
  const claims = data?.entities?.[wikidataId]?.claims?.P18 || [];

  for (const claim of claims) {
    const fileName = claim?.mainsnak?.datavalue?.value;
    const imageUrl = await fetchCommonsImageForFile(fileName);
    if (scoreCandidate({ title: fileName, imageUrl, place }) >= RELIABLE_IMAGE_SCORE) return imageUrl;
  }

  return '';
};

const fetchCommonsSearchImage = async (query, place) => {
  const url = buildApiUrl('https://commons.wikimedia.org/w/api.php', {
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: String(MAX_SEARCH_RESULTS),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '1200',
  });
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});
  const candidates = pages
    .map(page => {
      const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
      const imageUrl = [imageInfo?.thumburl, imageInfo?.url].find(isUsablePlaceImage) || '';
      return {
        title: page.title || '',
        imageUrl,
        score: scoreCandidate({ title: page.title, imageUrl, query, place }),
      };
    })
    .filter(candidate => candidate.imageUrl && candidate.score >= RELIABLE_IMAGE_SCORE)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.imageUrl || '';
};

const resolvePlaceImage = async (place, options = {}) => {
  const existingImage = getBestExistingImage(place);
  if (existingImage && !options.ignoreExisting) return existingImage;

  const name = place?.name || '';
  const city = place?.city || '';
  const address = place?.address || '';
  const cacheKey = `${name}|${city}|${address}|${options.ignoreExisting ? 'refresh' : 'normal'}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  const titleCandidates = buildWikipediaTitleCandidates(place);
  const queries = buildPlaceImageQueries(place);
  let imageUrl = '';
  const searchCandidates = [];

  for (const title of titleCandidates) {
    for (const language of WIKIPEDIA_LANGUAGES) {
      imageUrl = await fetchWikipediaSummaryImage(language, title);
      if (imageUrl && scoreCandidate({ title, imageUrl, query: title, place }) < RELIABLE_IMAGE_SCORE) {
        imageUrl = '';
      }
      if (imageUrl) break;
    }
    if (imageUrl) break;
  }

  if (!imageUrl) {
    for (const query of queries) {
      for (const language of WIKIPEDIA_LANGUAGES) {
        const candidates = await fetchWikipediaSearchCandidates(language, query, place);
        searchCandidates.push(...candidates);
        const pageImage = candidates.find(candidate => candidate.imageUrl && candidate.score >= RELIABLE_IMAGE_SCORE);
        if (pageImage) {
          imageUrl = pageImage.imageUrl;
          break;
        }
      }
      if (imageUrl) break;
    }
  }

  if (!imageUrl) {
    const wikidataCandidates = searchCandidates
      .filter(candidate => candidate.wikidataId && candidate.score >= 0)
      .sort((a, b) => b.score - a.score);

    for (const candidate of wikidataCandidates) {
      imageUrl = await fetchWikidataP18Image(candidate.wikidataId, place);
      if (imageUrl) break;
    }
  }

  if (!imageUrl) {
    for (const query of queries) {
      imageUrl = await fetchCommonsSearchImage(query, place);
      if (imageUrl) break;
    }
  }

  imageCache.set(cacheKey, imageUrl);
  return imageUrl;
};

const clearImageCache = () => imageCache.clear();

module.exports = {
  resolvePlaceImage,
  isUsablePlaceImage,
  isExistingImageReliable,
  shouldReplacePlaceImage,
  buildPlaceImageQueries,
  buildWikipediaTitleCandidates,
  scoreCandidate,
  clearImageCache,
  getFirstUsableImage,
};
