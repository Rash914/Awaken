// Dev helper: search YouTube for candidate tutorial videos.
// Usage: node scripts/yt-search.mjs "query one" "query two" ...
// Prints: videoId | duration | channel | title  (top 5 per query)
const queries = process.argv.slice(2);

async function search(q) {
  const url = 'https://www.youtube.com/results?hl=en&gl=US&search_query=' + encodeURIComponent(q);
  const html = await (await fetch(url, { headers: { 'accept-language': 'en-US' } })).text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  const data = JSON.parse(m[1]);
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== 'object' || out.length >= 5) return;
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      out.push([v.videoId, v.lengthText?.simpleText ?? '?', v.ownerText?.runs?.[0]?.text ?? '?', v.title?.runs?.[0]?.text ?? '?'].join(' | '));
      return;
    }
    for (const k in o) walk(o[k]);
  })(data);
  return out;
}

for (const q of queries) {
  console.log('## ' + q);
  try { (await search(q)).forEach((l) => console.log('  ' + l)); } catch (e) { console.log('  ERR ' + e.message); }
}
