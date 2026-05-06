const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyCandidate } = require('../scripts/queuePlaceImages');

test('queue classifier accepts strong exact Wikimedia candidates', () => {
  const place = { name: 'Dolmabahce Sarayi', city: 'Istanbul', category: 'historical' };
  const result = classifyCandidate({
    place,
    title: 'Dolmabahce Palace',
    query: 'Dolmabahce Sarayi',
    sourceType: 'exact_summary',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Dolmabahce_Istanbul_Turkey.jpg',
  });

  assert.equal(result.status, 'strong');
  assert.ok(result.score >= 80);
  assert.ok(result.reasonFlags.includes('exact_page_context'));
});

test('queue classifier rejects wrong-city image candidates', () => {
  const place = { name: 'Hüsrev Paşa Camii', city: 'Van', category: 'mosque' };
  const result = classifyCandidate({
    place,
    title: 'Hüsrev Paşa Camii',
    query: 'Hüsrev Paşa Camii Van',
    sourceType: 'wiki_search_pageimage',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Diyarbak%C4%B1r_H%C3%BCsrev_Pa%C5%9Fa_Mosque7956.jpg',
  });

  assert.equal(result.status, 'rejected');
  assert.ok(result.reasonFlags.includes('wrong_city_signal'));
});

test('queue classifier rejects maps and location images', () => {
  const place = { name: 'Kyzikos Antik Kenti', city: 'Balikesir', category: 'ruins' };
  const result = classifyCandidate({
    place,
    title: 'Kyzikos',
    query: 'Kyzikos',
    sourceType: 'exact_summary',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Kyzikos_location_map.svg.png',
  });

  assert.equal(result.status, 'rejected');
  assert.ok(result.reasonFlags.includes('unusable_image'));
});

test('queue classifier marks medium confidence candidates for review', () => {
  const place = { name: 'Aspendos Tiyatrosu', city: 'Antalya', category: 'ruins' };
  const result = classifyCandidate({
    place,
    title: 'Aspendos',
    query: 'Aspendos Tiyatrosu',
    sourceType: 'wiki_search_pageimage',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Aspendos_Amphitheatre.jpg',
  });

  assert.equal(result.status, 'needs_review');
  assert.ok(result.score >= 18);
});
