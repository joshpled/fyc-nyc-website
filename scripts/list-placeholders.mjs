// Lists every unknown fact still left in src/data (nulls, drafts, unconfirmed flags).
// Run: npm run placeholders
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../src/data/', import.meta.url).pathname;
const rows = [];

function walk(value, path, file) {
  if (value === null) return rows.push(`${file}: ${path}`);
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`, file));
  if (typeof value === 'object') {
    if (value.placeholder === true) return rows.push(`${file}: ${path} (placeholder row: add a real item or delete it)`);
    if (value.draft === true) rows.push(`${file}: ${path} (draft event "${value.title}": confirm or delete)`);
    if (value.paraphrased === true) rows.push(`${file}: ${path} (review is paraphrased: paste the exact words)`);
    if (value.confirmed === false) rows.push(`${file}: ${path || '(root)'} (marked unconfirmed)`);
    for (const [k, v] of Object.entries(value)) if (!k.startsWith('_')) walk(v, path ? `${path}.${k}` : k, file);
    return;
  }
  if (typeof value === 'string' && value === '' ) rows.push(`${file}: ${path} (empty)`);
}

for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  walk(JSON.parse(readFileSync(join(dir, f), 'utf8')), '', f);
}
console.log(rows.join('\n'));
console.log(`\n${rows.length} items to fill in before launch.`);
