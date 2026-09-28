// Build: copy src/ -> dist/, stamp the service worker with a content hash + precache list.
// No bundler needed: the app is native ES modules.
import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
cpSync(src, dist, { recursive: true });

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(dist);

const assets = files.map((p) => './' + relative(dist, p).split(sep).join('/')).filter((p) => p !== './sw.js').sort();
const hash = createHash('sha256');
for (const a of assets) hash.update(a).update(readFileSync(join(dist, a)));
const version = hash.digest('hex').slice(0, 12);

const swPath = join(dist, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace("'__VERSION__'", `'${version}'`).replace('__ASSETS__', JSON.stringify(['./', ...assets])));
console.log(`dist/ built: ${assets.length} files, sw version ${version}`);
