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

test('resolves Dolmabahce Sarayi through palace variants', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/Dolmabahce%20Palace')) {
      return jsonResponse({
        originalimage: {
          source: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Dolmabahce_Palace_Istanbul.jpg',
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Dolmabahce Sarayi', city: 'Istanbul', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/4/44/Dolmabahce_Palace_Istanbul.jpg');
});

test('accepts Hasankeyf page summary images that match the place token', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/Hasankeyf')) {
      return jsonResponse({
        title: 'Hasankeyf',
        originalimage: {
          source: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Hasankeyf.JPG',
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Hasankeyf', city: 'Batman', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Hasankeyf.JPG');
});

test('lets specific search outrank broad stripped summary titles', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/Hasankeyf%20Kalesi')) {
      return jsonResponse({}, false);
    }

    if (url.pathname.includes('/api/rest_v1/page/summary/hasankeyf%20kalesi')) {
      return jsonResponse({}, false);
    }

    if (url.pathname.includes('/api/rest_v1/page/summary/Hasankeyf')) {
      return jsonResponse({
        title: 'Hasankeyf',
        originalimage: {
          source: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Hasankeyf.JPG',
        },
      });
    }

    if (url.hostname.includes('wikipedia.org')) {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'Hasankeyf Castle',
              original: {
                source: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Hasankeyf_Castle.jpg',
              },
            },
          },
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Hasankeyf Kalesi', city: 'Batman', address: 'Hasankeyf/Batman', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/8/86/Hasankeyf_Castle.jpg');
});

test('uses exact article images when Wikipedia summary image is a logo', async () => {
  let commonsTitles = '';

  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/Anadolu%20Medeniyetleri%20M%C3%BCzesi')) {
      return jsonResponse({
        title: 'Anadolu Medeniyetleri Müzesi',
        originalimage: {
          source: 'https://upload.wikimedia.org/wikipedia/commons/9/9f/100._YIL_LOGO.jpg',
        },
      });
    }

    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org')) {
      assert.equal(url.searchParams.get('prop'), 'images|pageprops');
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'Anadolu Medeniyetleri Müzesi',
              images: [
                { title: 'Dosya:100. YIL LOGO.jpg' },
                { title: 'Dosya:Museum of Anatolian Civilizations025.jpg' },
              ],
            },
          },
        },
      });
    }

    assert.equal(url.hostname, 'commons.wikimedia.org');
    commonsTitles = url.searchParams.get('titles');

    return jsonResponse({
      query: {
        pages: {
          1: {
            title: 'File:100. YIL LOGO.jpg',
            imageinfo: [
              {
                thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/100._YIL_LOGO.jpg/1000px-100._YIL_LOGO.jpg',
              },
            ],
          },
          2: {
            title: 'File:Museum of Anatolian Civilizations025.jpg',
            imageinfo: [
              {
                thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Museum_of_Anatolian_Civilizations025.jpg/1200px-Museum_of_Anatolian_Civilizations025.jpg',
              },
            ],
          },
        },
      },
    });
  });

  const place = { name: 'Anadolu Medeniyetleri Müzesi', city: 'Ankara', images: [] };
  const image = await resolvePlaceImage(place);

  assert.equal(
    image,
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Museum_of_Anatolian_Civilizations025.jpg/1200px-Museum_of_Anatolian_Civilizations025.jpg'
  );
  assert.equal(shouldReplacePlaceImage(place, '', image), true);
  assert.ok(commonsTitles.includes('File:100. YIL LOGO.jpg'));
  assert.ok(commonsTitles.includes('File:Museum of Anatolian Civilizations025.jpg'));
});

test('resolves SEKA paper museum through Turkish and English title variants', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/SEKA%20Paper%20Museum')) {
      return jsonResponse({
        title: 'SEKA Paper Museum',
        originalimage: {
          source: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/SEKA_Ka%C4%9F%C4%B1t_M%C3%BCzesi.jpg',
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Seka Kağıt Müzesi', city: 'Kocaeli', images: [] });
  const queries = buildPlaceImageQueries({ name: 'Seka Kağıt Müzesi', city: 'Kocaeli' });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/3/3a/SEKA_Ka%C4%9F%C4%B1t_M%C3%BCzesi.jpg');
  assert.ok(queries.includes('SEKA Paper Museum'));
  assert.ok(queries.includes('SEKA Kâğıt Müzesi'));
});

test('rejects incompatible exact-article images such as a mosque for a clock tower', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org') && url.searchParams.get('prop') === 'images|pageprops') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'Bilecik Saat Kulesi',
              images: [
                { title: 'File:Brainsik-bluemosque.jpg' },
              ],
            },
          },
        },
      });
    }

    if (url.hostname.includes('wikipedia.org')) {
      return jsonResponse({
        query: {
          pages: {
            2: {
              title: 'Bilecik Saat Kulesi',
              original: {
                source: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Brainsik-bluemosque.jpg',
              },
            },
          },
        },
      });
    }

    if (url.hostname === 'commons.wikimedia.org') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'File:Brainsik-bluemosque.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Brainsik-bluemosque.jpg/1280px-Brainsik-bluemosque.jpg',
                },
              ],
            },
          },
        },
      });
    }

    return jsonResponse({}, false);
  });

  const image = await resolvePlaceImage({ name: 'Bilecik Saat Kulesi', city: 'Bilecik', images: [] });

  assert.equal(image, '');
});

test('skips article plan images and accepts a later castle photo', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org') && url.searchParams.get('prop') === 'images|pageprops') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'Kutahya Kalesi',
              images: [
                { title: 'File:Kutahya Castle plan.jpg' },
                { title: 'File:Kutahya Castle walls.jpg' },
              ],
            },
          },
        },
      });
    }

    if (url.hostname === 'commons.wikimedia.org') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'File:Kutahya Castle plan.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Kutahya_Castle_plan.jpg',
                },
              ],
            },
            2: {
              title: 'File:Kutahya Castle walls.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Kutahya_Castle_walls.jpg',
                },
              ],
            },
          },
        },
      });
    }

    return jsonResponse({ query: { pages: {} } });
  });

  const image = await resolvePlaceImage({ name: 'Kutahya Kalesi', city: 'Kutahya', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/2/22/Kutahya_Castle_walls.jpg');
});

test('accepts Kütahya castle article photo named with hisar synonym', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org') && url.searchParams.get('prop') === 'images|pageprops') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'Kütahya Kalesi',
              images: [
                { title: 'Dosya:Kütahya kalesi planı.JPG' },
                { title: 'Dosya:Kütahya hisar-üçler tepesinden.jpg' },
              ],
            },
          },
        },
      });
    }

    if (url.hostname === 'commons.wikimedia.org') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'File:Kütahya kalesi planı.JPG',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/7/74/K%C3%BCtahya_kalesi_plan%C4%B1.JPG',
                },
              ],
            },
            2: {
              title: 'File:Kütahya hisar-üçler tepesinden.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/5/55/K%C3%BCtahya_hisar-%C3%BC%C3%A7ler_tepesinden.jpg',
                },
              ],
            },
          },
        },
      });
    }

    return jsonResponse({ query: { pages: {} } });
  });

  const image = await resolvePlaceImage({ name: 'Kütahya Kalesi', city: 'Kütahya', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/5/55/K%C3%BCtahya_hisar-%C3%BC%C3%A7ler_tepesinden.jpg');
});

test('uses Wikidata P18 from an exact summary when summary image is a plan', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/K%C3%BCtahya%20Kalesi')) {
      return jsonResponse({
        title: 'Kütahya Kalesi',
        wikibase_item: 'Q6022256',
        originalimage: {
          source: 'https://upload.wikimedia.org/wikipedia/commons/7/74/K%C3%BCtahya_kalesi_plan%C4%B1.JPG',
        },
      });
    }

    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname === 'www.wikidata.org') {
      return jsonResponse({
        entities: {
          Q6022256: {
            claims: {
              P18: [
                {
                  mainsnak: {
                    datavalue: { value: 'Kütahya hisar-üçler tepesinden.jpg' },
                  },
                },
              ],
            },
          },
        },
      });
    }

    if (url.hostname === 'commons.wikimedia.org') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'File:Kütahya hisar-üçler tepesinden.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/K%C3%BCtahya_hisar-%C3%BC%C3%A7ler_tepesinden.jpg/1280px-K%C3%BCtahya_hisar-%C3%BC%C3%A7ler_tepesinden.jpg',
                },
              ],
            },
          },
        },
      });
    }

    return jsonResponse({ query: { pages: {} } });
  });

  const image = await resolvePlaceImage({ name: 'Kütahya Kalesi', city: 'Kütahya', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/K%C3%BCtahya_hisar-%C3%BC%C3%A7ler_tepesinden.jpg/1280px-K%C3%BCtahya_hisar-%C3%BC%C3%A7ler_tepesinden.jpg');
});

test('uses Commons file prefix search for castle photos when article images miss', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org')) {
      return jsonResponse({ query: { pages: {} } });
    }

    if (url.hostname === 'commons.wikimedia.org' && url.searchParams.get('generator') === 'prefixsearch') {
      return jsonResponse({
        query: {
          pages: {
            1: {
              title: 'File:Kutahya castle plan.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Kutahya_castle_plan.jpg',
                },
              ],
            },
            2: {
              title: 'File:Kutahya castle 8722.jpg',
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Kutahya_castle_8722.jpg',
                },
              ],
            },
          },
        },
      });
    }

    return jsonResponse({ query: { pages: {} } });
  });

  const image = await resolvePlaceImage({ name: 'Kutahya Kalesi', city: 'Kutahya', images: [] });

  assert.equal(image, 'https://upload.wikimedia.org/wikipedia/commons/2/22/Kutahya_castle_8722.jpg');
});

test('resolves from MediaWiki page image search when summary misses', async () => {
  mockFetch((url) => {
    if (url.pathname.includes('/api/rest_v1/page/summary/')) {
      return jsonResponse({}, false);
    }

    if (url.hostname.includes('wikipedia.org') && url.searchParams.get('prop') === 'images|pageprops') {
      return jsonResponse({ query: { pages: {} } });
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

    if (url.hostname.includes('wikipedia.org') && url.searchParams.get('prop') === 'images|pageprops') {
      return jsonResponse({ query: { pages: {} } });
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

    if (url.hostname.includes('wikipedia.org') && url.searchParams.get('prop') === 'images|pageprops') {
      return jsonResponse({ query: { pages: {} } });
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

    if (url.hostname.includes('wikipedia.org') && url.searchParams.get('prop') === 'images|pageprops') {
      return jsonResponse({ query: { pages: {} } });
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

test('builds English phrase variants for Batman place names', () => {
  assert.ok(buildPlaceImageQueries({ name: 'Hasankeyf Kalesi', city: 'Batman' }).includes('hasankeyf castle'));
  assert.ok(buildPlaceImageQueries({ name: 'Zeynel Bey Türbesi', city: 'Batman' }).includes('zeynel bey tomb'));
  assert.ok(buildPlaceImageQueries({ name: 'Malabadi Köprüsü', city: 'Batman' }).includes('malabadi bridge'));
});

test('builds Turkish restored and palace variants for ASCII seed names', () => {
  const queries = buildPlaceImageQueries({ name: 'Dolmabahce Sarayi', city: 'Istanbul' });

  assert.ok(queries.includes('Dolmabahce Palace'));
  assert.ok(queries.includes('Dolmabahçe Sarayı'));
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
  const generic = 'https://upload.wikimedia.org/wikipedia/commons/7/71/Erdek_panorama.jpg';

  assert.equal(shouldReplacePlaceImage(place, current, next), true);
  assert.equal(shouldReplacePlaceImage(place, '', next), true);
  assert.equal(shouldReplacePlaceImage(place, '', generic), false);
  assert.equal(shouldReplacePlaceImage(place, next, current), false);
});
