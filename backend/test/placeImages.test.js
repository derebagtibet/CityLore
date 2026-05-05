const assert = require('node:assert/strict');
const test = require('node:test');
const {
  resolvePlaceImage,
  isUsablePlaceImage,
  isExistingImageReliable,
  shouldReplacePlaceImage,
  buildPlaceImageQueries,
  buildWikipediaTitleCandidates,
  clearImageCache,
} = require('../utils/placeImages');

const jsonResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
});

const mockFetch = (handler) => {
  global.fetch = async (url) => handler(new URL(url));
};

test.afterEach(() => {
  clearImageCache();
  delete global.fetch;
});

test('reuses an existing reliable place-specific image', async () => {
  const existing = 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Bandirma_Gemi_Muzesi.jpg';
  const image = await resolvePlaceImage({
    name: 'Bandirma Gemi-Muzesi',
    city: 'Samsun',
    images: [
      'https://upload.wikimedia.org/wikipedia/commons/f/ff/flag.svg',
      existing,
    ],
  });

  assert.equal(image, existing);
});

test('rejects bad image types and unwanted generic image names', () => {
  assert.equal(isUsablePlaceImage('https://example.com/photo.webm'), false);
  assert.equal(isUsablePlaceImage('https://example.com/thumb/Turkey_location.svg/1200px-Turkey_location.svg.png'), false);
  assert.equal(isUsablePlaceImage('https://example.com/City_map.jpg'), false);
  assert.equal(isUsablePlaceImage('https://example.com/coat_of_arms.png'), false);
  assert.equal(isUsablePlaceImage('https://example.com/site.jpeg'), true);
});

test('marks city-only Wikimedia images as unreliable for specific places', () => {
  const place = { name: 'Kyzikos Antik Kenti', city: 'Balikesir', address: 'Erdek/Balikesir' };

  assert.equal(
    isExistingImageReliable(place, 'https://upload.wikimedia.org/wikipedia/commons/7/71/Erdek.jpg'),
    false
  );
  assert.equal(
    isExistingImageReliable(place, 'https://upload.wikimedia.org/wikipedia/commons/9/96/Cyzicus_amphitheatre_15.jpg'),
    true
  );
});

test('resolves ancient-site names from stripped title candidates', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/Kyzikos')) {
      return jsonResponse({
        originalimage: {
          source: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Cyzicus_amphitheatre_15.jpg',
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Kyzikos Antik Kenti', city: 'Balikesir', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/9/96/Cyzicus_amphitheatre_15.jpg');
});

test('resolves from MediaWiki page image search when summary misses', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    assert.equal(url.searchParams.get('generator'), 'search');
    assert.equal(url.searchParams.get('prop'), 'pageimages|pageprops');
    return jsonResponse({
      query: {
        pages: {
          1: {
            title: 'Izmir Clock Tower',
            original: {
              source: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Izmir_Clock_Tower.jpg',
            },
            pageprops: { wikibase_item: 'Q123' },
          },
        },
      },
    });
  });

  const image = await resolvePlaceImage({ name: 'Izmir Saat Kulesi', city: 'Izmir', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/2/22/Izmir_Clock_Tower.jpg');
});

test('uses Wikidata P18 when page search only finds generic images', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org')) {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'Deyrulzafaran Monastery',
              thumbnail: {
                source: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Mardin_in_Turkey.svg.png',
              },
              pageprops: { wikibase_item: 'Q456' },
            },
          },
        },
      });
    }

    if (url.hostname === 'www.wikidata.org') {
      return jsonResponse({
        entities: {
          Q456: {
            claims: {
              P18: [
                {
                  mainsnak: {
                    datavalue: { value: 'Deyrulzafaran_Monastery_Mardin.jpg' },
                  },
                },
              ],
            },
          },
        },
      });
    }

    assert.equal(url.hostname, 'commons.wikimedia.org');
    return jsonResponse({
      query: {
        pages: {
          7: {
            imageinfo: [
              {
                thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Deyrulzafaran_Monastery_Mardin.jpg/1200px-Deyrulzafaran_Monastery_Mardin.jpg',
                url: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Deyrulzafaran_Monastery_Mardin.jpg',
              },
            ],
          },
        },
      },
    });
  });

  const image = await resolvePlaceImage({ name: 'Deyrulzafaran Manastiri', city: 'Mardin', images: [] });

  assert.equal(
    image,
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Deyrulzafaran_Monastery_Mardin.jpg/1200px-Deyrulzafaran_Monastery_Mardin.jpg'
  );
});

test('resolves from Commons search as a final fallback', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org')) {
      return jsonResponse({ query: { pages: {} } });
    }

    if (url.hostname === 'commons.wikimedia.org') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'File:Bandirma_Gemi_Muzesi_Samsun.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Bandirma_Gemi_Muzesi_Samsun.jpg/1200px-Bandirma_Gemi_Muzesi_Samsun.jpg',
                },
              ],
            },
          },
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Bandirma Gemi-Muzesi', city: 'Samsun', images: [] });

  assert.equal(
    image,
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Bandirma_Gemi_Muzesi_Samsun.jpg/1200px-Bandirma_Gemi_Muzesi_Samsun.jpg'
  );
});

test('rejects generic Commons fallback images', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org')) {
      return jsonResponse({ query: { pages: {} } });
    }

    if (url.hostname === 'commons.wikimedia.org') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'File:Erdek_panorama.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Erdek_panorama.jpg',
                },
              ],
            },
          },
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Kyzikos Antik Kenti', city: 'Balikesir', address: 'Erdek/Balikesir', images: [] });

  assert.equal(image, '');
});

test('builds stripped, ASCII, city, address, and Turkey query variants', () => {
  const queries = buildPlaceImageQueries({
    name: 'Kyzikos Antik Kenti',
    city: 'Balikesir',
    address: 'Erdek/Balikesir',
  });

  assert.ok(queries.includes('Kyzikos Antik Kenti'));
  assert.ok(queries.includes('Kyzikos'));
  assert.ok(queries.includes('Cyzicus'));
  assert.ok(queries.includes('Kyzikos Antik Kenti Balikesir'));
  assert.ok(queries.includes('Kyzikos Antik Kenti Erdek'));
  assert.ok(queries.includes('Kyzikos Antik Kenti Turkey'));
});

test('builds stripped Wikipedia title candidates', () => {
  const titles = buildWikipediaTitleCandidates({ name: 'Kyzikos Antik Kenti' });

  assert.ok(titles.includes('Kyzikos'));
  assert.ok(titles.includes('Cyzicus'));
});

test('requires a clearly better replacement for suspicious saved images', () => {
  const place = { name: 'Kyzikos Antik Kenti', city: 'Balikesir', address: 'Erdek/Balikesir' };
  const current = 'https://upload.wikimedia.org/wikipedia/commons/7/71/Erdek.jpg';
  const next = 'https://upload.wikimedia.org/wikipedia/commons/9/96/Cyzicus_amphitheatre_15.jpg';

  assert.equal(shouldReplacePlaceImage(place, current, next), true);
  assert.equal(shouldReplacePlaceImage(place, next, current), false);
});
