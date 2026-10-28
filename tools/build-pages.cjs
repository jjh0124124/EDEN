// Copy only public game files; no development tools, tests, or repository metadata.
const { cpSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const out = resolve(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const name of ['index.html', 'styles.css', 'src', 'assets']) {
  cpSync(resolve(root, name), resolve(out, name), { recursive: true });
}
writeFileSync(resolve(out, '.nojekyll'), '');
console.log('Pages files ready in dist/ (relative asset URLs support /EDEN/).');
