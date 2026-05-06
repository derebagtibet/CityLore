const imageCache = new Map();
const resolvedImageContextCache = new Map();

const IMAGE_TIMEOUT_MS = 8000;
const IMAGE_FETCH_RETRIES = 2;
const IMAGE_RETRY_DELAY_MS = 1200;
const WIKIPEDIA_LANGUAGES = ['tr', 'en'];
const MAX_SEARCH_RESULTS = 6;
const MAX_ARTICLE_IMAGES = 50;
const MAX_COMMONS_FALLBACK_QUERIES = 5;
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
  'floor_plan',
  'icon',
  'layout',
  'location',
  'logo',
  'map',
  'non_political',
  'placeholder',
  'plan',
  'political',
  'scheme',
  'seal',
  'sketch',
  'symbol',
  'wordmark',
];

const GENERIC_PLACE_WORDS = new Set([
  'acik',
  'air',
  'antik',
  'ancient',
  'archaeological',
  'bridge',
  'camii',
  'camisi',
  'cami',
  'castle',
  'city',
  'clock',
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
  'kopru',
  'koprusu',
  'monastery',
  'mosque',
  'muze',
  'museum',
  'muzesi',
  'open',
  'oren',
  'palace',
  'sarayi',
  'saat',
  'sehir',
  'sehri',
  'site',
  'tapinagi',
  'temple',
  'turbe',
  'turbesi',
  'tomb',
  'tower',
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
  ' sarayi',
  ' sarayı',
  ' turbesi',
  ' türbesi',
  ' koprusu',
  ' köprüsü',
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
  ['sarayi', 'palace'],
  ['sarayı', 'palace'],
  ['turbesi', 'tomb'],
  ['türbesi', 'tomb'],
  ['koprusu', 'bridge'],
  ['köprüsü', 'bridge'],
  ['kagit muzesi', 'paper museum'],
  ['kağıt müzesi', 'paper museum'],
  ['kâğıt müzesi', 'paper museum'],
];

const ASCII_TURKISH_PHRASES = [
  ['dolmabahce', 'Dolmabahçe'],
  ['besiktas', 'Beşiktaş'],
  ['istanbul', 'İstanbul'],
  ['sarayi', 'Sarayı'],
  ['turbesi', 'Türbesi'],
  ['koprusu', 'Köprüsü'],
  ['kagit', 'Kağıt'],
  ['kagidi', 'Kağıdı'],
  ['muzesi', 'Müzesi'],
  ['manastiri', 'Manastırı'],
  ['tapinagi', 'Tapınağı'],
  ['yeralti sehri', 'Yeraltı Şehri'],
  ['acik hava muzesi', 'Açık Hava Müzesi'],
];

const NON_REQUIRED_DESCRIPTOR_VARIANTS = new Set([
  'ancient city',
  'archaeological site',
  'open air museum',
]);

const DESCRIPTOR_GROUPS = [
  ['clock', 'tower', 'saat', 'kulesi'],
  ['mosque', 'camii', 'camisi', 'cami'],
  ['castle', 'fortress', 'kale', 'kalesi', 'hisar', 'hisari'],
  ['museum', 'muze', 'muzesi', 'müzesi', 'muzeum'],
  ['paper', 'kagit', 'kagidi', 'kağıt', 'kâğıt', 'seka'],
  ['bridge', 'kopru', 'koprusu', 'köprü', 'köprüsü'],
  ['monastery', 'manastir', 'manastiri', 'manastırı'],
  ['palace', 'saray', 'sarayi', 'sarayı'],
  ['tomb', 'turbe', 'turbesi', 'türbe', 'türbesi'],
  ['temple', 'tapinak', 'tapinagi', 'tapınağı'],
];

const knownImageTitles = {
  'anadolu medeniyetleri muzesi': 'Museum of Anatolian Civilizations',
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
  'dolmabahce sarayi': 'Dolmabahce Palace',
  'dolmabahce palace': 'Dolmabahce Palace',
  'dolmabahce sarayı': 'Dolmabahçe Sarayı',
  'dolmabahçe sarayı': 'Dolmabahçe Sarayı',
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
  'seka kagit muzesi': 'SEKA Paper Museum',
  'seka kagit museum': 'SEKA Paper Museum',
  'seka paper museum': 'SEKA Paper Museum',
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getConfiguredNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

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

const getPlaceCacheKey = (place, imageUrl = '') => [
  place?.name || '',
  place?.city || '',
  place?.address || '',
  imageUrl,
].join('|');

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

const restoreTurkishPhrases = (value) => {
  let output = String(value || '');
  for (const [ascii, turkish] of ASCII_TURKISH_PHRASES) {
    output = output.replace(new RegExp(`\\b${ascii}\\b`, 'gi'), turkish);
  }
  return output;
};

const getNameVariants = (name = '') => {
  const variants = [];
  const baseName = String(name || '').trim();
  const noParentheses = withoutParentheses(baseName);
  const normalized = normalizeText(baseName);
  const knownTitle = knownImageTitles[normalized];

  addUnique(variants, baseName);
  addUnique(variants, knownTitle);
  addUnique(variants, noParentheses);
  addUnique(variants, normalized);
  addUnique(variants, restoreTurkishPhrases(normalized));

  for (const [from, to] of NAME_PHRASE_VARIANTS) {
    const fromRegex = new RegExp(`\\b${from}\\b`, 'i');
    if (fromRegex.test(normalized)) {
      addUnique(variants, normalized.replace(fromRegex, to));
    }
  }

  for (const shortened of removeGenericTitleSuffixes(baseName)) {
    addUnique(variants, shortened);
    addUnique(variants, restoreTurkishPhrases(shortened));
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

  const key = normalizeText(baseName);
  if (key.includes('seka') && key.includes('kagit')) {
    addUnique(variants, 'SEKA Kağıt Müzesi');
    addUnique(variants, 'SEKA Kâğıt Müzesi');
    addUnique(variants, 'SEKA Paper Museum');
    addUnique(variants, 'seka paper museum');
  }

  return variants;
};

const getSignificantTokens = (place) => {
  const cityTokens = new Set(normalizeText(place?.city).split(' ').filter(Boolean));
  const tokens = new Set();

  for (const variant of getNameVariants(place?.name)) {
    for (const token of normalizeText(variant).split(' ')) {
      if (token.length < 3) continue;
      if (GENERIC_PLACE_WORDS.has(token)) continue;
      if (cityTokens.has(token)) continue;
      tokens.add(token);
    }
  }

  return [...tokens];
};

const getRequiredDescriptorTokens = (place) => {
  const normalizedName = normalizeText(place?.name);
  const tokens = new Set();

  for (const [from, to] of NAME_PHRASE_VARIANTS) {
    if (NON_REQUIRED_DESCRIPTOR_VARIANTS.has(to)) continue;
    const normalizedFrom = normalizeText(from);
    if (!normalizedFrom || !normalizedName.includes(normalizedFrom)) continue;

    for (const token of normalizedFrom.split(' ')) {
      if (token.length >= 3) tokens.add(token);
    }
    for (const token of normalizeText(to).split(' ')) {
      if (token.length >= 3) tokens.add(token);
    }
  }

  return [...tokens];
};

const getDescriptorGroups = (text = '') => {
  const normalized = normalizeText(text);
  return DESCRIPTOR_GROUPS
    .filter(group => group.some(token => normalized.includes(token)))
    .map(group => new Set(group));
};

const hasDescriptorGroupMatch = (requiredGroup, text = '') => {
  const normalized = normalizeText(text);
  return [...requiredGroup].some(token => normalized.includes(token));
};

const hasIncompatibleDescriptor = (place, title = '', imageUrl = '') => {
  const requiredGroups = getDescriptorGroups(place?.name);
  if (!requiredGroups.length) return false;

  const imageText = `${title} ${getImageText(imageUrl)}`;
  const imageGroups = getDescriptorGroups(imageText);
  if (!imageGroups.length) return false;

  return imageGroups.some(imageGroup =>
    !requiredGroups.some(requiredGroup =>
      [...imageGroup].some(token => requiredGroup.has(token))
    )
  );
};

const hasImageNamePlaceMatch = (place, imageUrl) => {
  const imageText = getImageText(imageUrl);
  if (!imageText) return false;

  const significantTokens = getSignificantTokens(place);
  if (significantTokens.some(token => imageText.includes(token))) return true;

  const descriptorTokens = getRequiredDescriptorTokens(place);
  if (descriptorTokens.some(token => imageText.includes(token))) return true;

  const requiredGroups = getDescriptorGroups(place?.name);
  if (requiredGroups.some(group => hasDescriptorGroupMatch(group, imageText))) return true;

  return false;
};

const hasCityOrAddressMatch = (place, text = '') => {
  const haystack = normalizeText(text);
  const city = normalizeText(place?.city);
  if (city && haystack.includes(city)) return true;

  return normalizeText(place?.address)
    .split(' ')
    .filter(token => token.length > 3 && !GENERIC_PLACE_WORDS.has(token))
    .some(token => haystack.includes(token));
};

const hasArticleImageSignal = (place, title = '', imageUrl = '') => {
  if (hasIncompatibleDescriptor(place, title, imageUrl)) return false;

  const imageText = `${title} ${getImageText(imageUrl)}`;
  if (getSignificantTokens(place).some(token => normalizeText(imageText).includes(token))) return true;

  const requiredGroups = getDescriptorGroups(place?.name);
  return requiredGroups.some(group => hasDescriptorGroupMatch(group, imageText));
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

const getCommonsFallbackQueries = (queries) => queries
  .filter(query => normalizeText(query).split(' ').length <= 4)
  .slice(0, MAX_COMMONS_FALLBACK_QUERIES);

const limitList = (values, limit) => {
  if (!Number.isFinite(limit) || limit <= 0) return values;
  return values.slice(0, limit);
};

const getCandidateConfidence = ({ title = '', imageUrl = '', query = '', place }) => {
  if (imageUrl && !isUsablePlaceImage(imageUrl)) return { score: -100, tokenHits: 0 };

  const significantTokens = getSignificantTokens(place);
  const haystack = normalizeText(`${title} ${getImageText(imageUrl)}`);
  const queryText = normalizeText(query);
  const city = normalizeText(place?.city);
  const addressTokens = normalizeText(place?.address).split(' ').filter(token => token.length > 3);
  const nameVariants = getNameVariants(place?.name).map(normalizeText).filter(Boolean);
  const fullName = normalizeText(place?.name);
  const exactNameMatch = nameVariants.some(variant => variant && haystack.includes(variant));
  const fullNameMatch = fullName && haystack.includes(fullName);
  const requiredDescriptorTokens = getRequiredDescriptorTokens(place);
  const descriptorMatch = requiredDescriptorTokens.length === 0 ||
    requiredDescriptorTokens.some(token => haystack.includes(token));
  const tokenHits = significantTokens.filter(token => haystack.includes(token));
  let score = 0;

  if (exactNameMatch) score += 70;
  if (fullNameMatch) score += 16;
  score += tokenHits.length * 28;
  if (tokenHits.length >= Math.min(2, significantTokens.length)) score += 20;
  if (city && haystack.includes(city) && tokenHits.length > 0) score += 8;
  if (addressTokens.some(token => haystack.includes(token)) && tokenHits.length > 0) score += 5;
  if (queryText && haystack.includes(queryText) && tokenHits.length > 0) score += 8;
  if (isWikimediaImage(imageUrl)) score += 4;

  if (tokenHits.length === 0) score -= 85;
  if (!descriptorMatch && !fullNameMatch) score -= 55;
  if (city && haystack.includes(city) && tokenHits.length === 0) score -= 45;
  if (GENERIC_IMAGE_HINTS.some(word => haystack.includes(word)) && tokenHits.length === 0) score -= 35;
  if (/\b(location|locator|adm|relief|karte|harita)\b/.test(haystack)) score -= 40;

  return { score, tokenHits: tokenHits.length, exactNameMatch, fullNameMatch, descriptorMatch };
};

const scoreCandidate = ({ title = '', imageUrl = '', query = '', place }) => {
  const resolvedContext = !title && !query
    ? resolvedImageContextCache.get(getPlaceCacheKey(place, imageUrl))
    : null;
  return getCandidateConfidence({
    title: resolvedContext?.title || title,
    imageUrl,
    query: resolvedContext?.query || query,
    place,
  }).score;
};

const isCandidateReliable = ({ title = '', imageUrl = '', query = '', place }) => {
  if (hasIncompatibleDescriptor(place, title, imageUrl)) return false;
  const confidence = getCandidateConfidence({ title, imageUrl, query, place });
  const haystack = `${title} ${getImageText(imageUrl)}`;
  if (
    !confidence.fullNameMatch &&
    getSignificantTokens(place).length <= 1 &&
    getRequiredDescriptorTokens(place).length > 0 &&
    !hasCityOrAddressMatch(place, haystack)
  ) {
    return false;
  }
  if (confidence.fullNameMatch && confidence.descriptorMatch && hasImageNamePlaceMatch(place, imageUrl)) {
    return true;
  }
  if (
    confidence.exactNameMatch &&
    confidence.descriptorMatch &&
    hasImageNamePlaceMatch(place, imageUrl) &&
    hasCityOrAddressMatch(place, haystack)
  ) {
    return true;
  }
  if (getRequiredDescriptorTokens(place).length > 0 && !confidence.fullNameMatch && confidence.score < 80) {
    return false;
  }
  return confidence.score >= RELIABLE_IMAGE_SCORE && (confidence.descriptorMatch || confidence.score >= 80);
};

const isSummaryCandidateReliable = ({ title = '', imageUrl = '', query = '', place }) =>
  isCandidateReliable({ title, imageUrl, query, place }) &&
  hasImageNamePlaceMatch(place, imageUrl);

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
  const resolvedContext = resolvedImageContextCache.get(getPlaceCacheKey(place, nextImage));
  const nextScore = resolvedContext
    ? scoreCandidate({ ...resolvedContext, imageUrl: nextImage, place })
    : scoreCandidate({ imageUrl: nextImage, place });
  const nextReliable = resolvedContext
    ? isCandidateReliable({ ...resolvedContext, imageUrl: nextImage, place })
    : isCandidateReliable({ imageUrl: nextImage, place });
  if (!currentImage || !isUsablePlaceImage(currentImage)) return nextReliable;
  if (isExistingImageReliable(place, currentImage)) return false;

  const currentScore = scoreCandidate({ imageUrl: currentImage, place });
  return nextReliable && nextScore >= currentScore + REPLACEMENT_MARGIN;
};

const fetchJson = async (url, attempt = 0) => {
  const controller = new AbortController();
  const imageTimeoutMs = getConfiguredNumber('CITYLORE_IMAGE_TIMEOUT_MS', IMAGE_TIMEOUT_MS);
  const imageFetchRetries = getConfiguredNumber('CITYLORE_IMAGE_RETRIES', IMAGE_FETCH_RETRIES);
  const timeout = setTimeout(() => controller.abort(), imageTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < imageFetchRetries) {
        const retryAfter = Number(response.headers?.get?.('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : IMAGE_RETRY_DELAY_MS * (attempt + 1);
        await delay(waitMs);
        return fetchJson(url, attempt + 1);
      }
      return null;
    }
    return response.json();
  } catch (err) {
    if (attempt < imageFetchRetries) {
      await delay(IMAGE_RETRY_DELAY_MS * (attempt + 1));
      return fetchJson(url, attempt + 1);
    }
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

const normalizeFileTitle = (title = '') => String(title || '')
  .replace(/^(Dosya|File):/i, 'File:')
  .trim();

const isExactArticleMatch = (place, title = '', query = '') => {
  const normalizedTitle = normalizeText(title);
  const normalizedQuery = normalizeText(query);
  const knownTitle = normalizeText(knownImageTitles[normalizeText(place?.name)]);
  const titleCandidates = buildWikipediaTitleCandidates(place).map(normalizeText);

  return Boolean(normalizedTitle) && (
    titleCandidates.includes(normalizedTitle) ||
    normalizedTitle === normalizedQuery ||
    (knownTitle && normalizedTitle === knownTitle)
  );
};

const fetchWikipediaSummaryCandidate = async (language, title) => {
  const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  const candidates = [
    data?.originalimage?.source,
    data?.thumbnail?.source,
  ].filter(Boolean);

  return {
    title: data?.title || title,
    imageUrl: candidates.find(isUsablePlaceImage) || '',
    wikidataId: data?.wikibase_item || '',
  };
};

const fetchWikipediaArticleImageCandidates = async (language, title, place) => {
  const url = buildApiUrl(`https://${language}.wikipedia.org/w/api.php`, {
    action: 'query',
    format: 'json',
    origin: '*',
    redirects: '1',
    titles: title,
    prop: 'images|pageprops',
    imlimit: String(MAX_ARTICLE_IMAGES),
    ppprop: 'wikibase_item',
  });
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});
  const page = pages.find(candidate => candidate?.title && !candidate.missing);
  if (!page || !isExactArticleMatch(place, page.title, title)) return [];

  const fileTitles = (page.images || [])
    .map(image => normalizeFileTitle(image.title))
    .filter(fileTitle => /^File:/i.test(fileTitle));
  const uniqueFileTitles = [...new Set(fileTitles)];
  const fileImages = await fetchCommonsImagesForFiles(uniqueFileTitles);
  const candidates = [];

  for (const { title: fileTitle, imageUrl } of fileImages) {
    if (!imageUrl) continue;

    const contextTitle = `${page.title} ${fileTitle}`;
    if (!hasArticleImageSignal(place, fileTitle, imageUrl)) continue;
    if (!isCandidateReliable({ title: contextTitle, imageUrl, query: title, place })) continue;

    candidates.push({
      title: contextTitle,
      imageUrl,
      wikidataId: page.pageprops?.wikibase_item || '',
      query: title,
      score: scoreCandidate({ title: contextTitle, imageUrl, query: title, place }),
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
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

const fetchCommonsImagesForFiles = async (fileNames) => {
  const titles = [...new Set((Array.isArray(fileNames) ? fileNames : [fileNames])
    .map(normalizeFileTitle)
    .filter(Boolean)
    .map(fileName => /^File:/i.test(fileName) ? fileName : `File:${fileName}`))];
  if (!titles.length) return [];

  const url = buildApiUrl('https://commons.wikimedia.org/w/api.php', {
    action: 'query',
    format: 'json',
    origin: '*',
    titles: titles.join('|'),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '1200',
  });
  const data = await fetchJson(url);

  return Object.values(data?.query?.pages || {})
    .map(page => {
      const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
      const candidates = [
        imageInfo?.thumburl,
        imageInfo?.url,
      ].filter(Boolean);

      return {
        title: page.title || '',
        imageUrl: candidates.find(isUsablePlaceImage) || '',
      };
    });
};

const fetchCommonsImageForFile = async (fileName) => {
  const candidates = await fetchCommonsImagesForFiles([fileName]);
  return candidates.find(candidate => candidate.imageUrl)?.imageUrl || '';
};

const fetchWikidataP18Image = async (wikidataId, place, contextTitle = '') => {
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
    if (isCandidateReliable({ title: `${contextTitle} ${fileName}`, imageUrl, place })) return imageUrl;
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
    .filter(candidate => candidate.imageUrl && isCandidateReliable({ title: candidate.title, imageUrl: candidate.imageUrl, query, place }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.imageUrl || '';
};

const fetchCommonsCategoryImage = async (query, place) => {
  const url = buildApiUrl('https://commons.wikimedia.org/w/api.php', {
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'categorymembers',
    gcmtitle: `Category:${query}`,
    gcmnamespace: '6',
    gcmlimit: String(MAX_SEARCH_RESULTS),
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
      const title = page.title || '';
      return {
        title,
        imageUrl,
        score: scoreCandidate({ title, imageUrl, query, place }),
      };
    })
    .filter(candidate => candidate.imageUrl && isCandidateReliable({ title: candidate.title, imageUrl: candidate.imageUrl, query, place }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.imageUrl || '';
};

const fetchCommonsPrefixImage = async (query, place) => {
  const url = buildApiUrl('https://commons.wikimedia.org/w/api.php', {
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'prefixsearch',
    gpssearch: query,
    gpsnamespace: '6',
    gpslimit: String(MAX_SEARCH_RESULTS),
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
    .filter(candidate => candidate.imageUrl && isCandidateReliable({ title: candidate.title, imageUrl: candidate.imageUrl, query, place }))
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

  const titleCandidates = limitList(buildWikipediaTitleCandidates(place), options.maxTitleCandidates);
  const queries = limitList(buildPlaceImageQueries(place), options.maxQueries);
  const commonsQueries = limitList(getCommonsFallbackQueries(queries), options.maxCommonsQueries);
  let imageUrl = '';
  let resolvedContext = null;
  const searchCandidates = [];

  for (const title of titleCandidates) {
    for (const language of WIKIPEDIA_LANGUAGES) {
      const candidate = await fetchWikipediaSummaryCandidate(language, title);
      imageUrl = candidate.imageUrl;
      if (imageUrl && !isSummaryCandidateReliable({ title: candidate.title, imageUrl, query: title, place })) {
        imageUrl = '';
      }
      if (!imageUrl && candidate.wikidataId) {
        imageUrl = await fetchWikidataP18Image(candidate.wikidataId, place, candidate.title);
      }
      if (imageUrl) {
        resolvedContext = { title: candidate.title, query: title };
        break;
      }
    }
    if (!imageUrl && !options.skipArticleImages) {
      const articleCandidates = [];
      for (const language of WIKIPEDIA_LANGUAGES) {
        articleCandidates.push(...await fetchWikipediaArticleImageCandidates(language, title, place));
      }

      const articleImage = articleCandidates[0];
      if (articleImage) {
        imageUrl = articleImage.imageUrl;
        resolvedContext = { title: articleImage.title, query: articleImage.query };
        break;
      }
    }
    if (imageUrl) break;
  }

  if (!imageUrl && options.exactOnly) {
    imageCache.set(cacheKey, '');
    return '';
  }

  if (!imageUrl) {
    for (const query of queries) {
      const queryCandidates = [];
      for (const language of WIKIPEDIA_LANGUAGES) {
        const candidates = await fetchWikipediaSearchCandidates(language, query, place);
        searchCandidates.push(...candidates);
        queryCandidates.push(...candidates);
      }

      const pageImage = queryCandidates
        .sort((a, b) => b.score - a.score)
        .find(candidate =>
          candidate.imageUrl &&
          isCandidateReliable({ title: candidate.title, imageUrl: candidate.imageUrl, query: candidate.query, place })
        );
      if (pageImage) {
        imageUrl = pageImage.imageUrl;
        resolvedContext = { title: pageImage.title, query: pageImage.query };
        break;
      }
    }
  }

  if (!imageUrl) {
    const wikidataCandidates = searchCandidates
      .filter(candidate => candidate.wikidataId && candidate.score >= 0)
      .sort((a, b) => b.score - a.score);

    for (const candidate of wikidataCandidates) {
      imageUrl = await fetchWikidataP18Image(candidate.wikidataId, place, candidate.title);
      if (imageUrl) {
        resolvedContext = { title: candidate.title, query: candidate.query };
        break;
      }
    }
  }

  if (!imageUrl) {
    for (const query of commonsQueries) {
      imageUrl = await fetchCommonsPrefixImage(query, place);
      if (imageUrl) break;
    }
  }

  if (!imageUrl) {
    for (const query of commonsQueries) {
      imageUrl = await fetchCommonsCategoryImage(query, place);
      if (imageUrl) {
        break;
      }
    }
  }

  if (!imageUrl) {
    for (const query of commonsQueries) {
      imageUrl = await fetchCommonsSearchImage(query, place);
      if (imageUrl) {
        break;
      }
    }
  }

  const hasReliableContext = resolvedContext &&
    isCandidateReliable({ ...resolvedContext, imageUrl, place });
  if (imageUrl && hasReliableContext) {
    resolvedImageContextCache.set(getPlaceCacheKey(place, imageUrl), resolvedContext);
  }

  if (imageUrl && !hasReliableContext && !shouldReplacePlaceImage(place, '', imageUrl)) {
    imageUrl = '';
  }

  imageCache.set(cacheKey, imageUrl);
  return imageUrl;
};

const clearImageCache = () => {
  imageCache.clear();
  resolvedImageContextCache.clear();
};

module.exports = {
  resolvePlaceImage,
  isUsablePlaceImage,
  isExistingImageReliable,
  shouldReplacePlaceImage,
  isCandidateReliable,
  buildPlaceImageQueries,
  buildWikipediaTitleCandidates,
  scoreCandidate,
  clearImageCache,
  getFirstUsableImage,
};
