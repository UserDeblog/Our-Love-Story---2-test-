import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(projectRoot, 'www');
const files = ['index.html', 'style.css', 'script.js', 'supabase-config.js', 'cloudflare-config.js'];
const directories = ['images', 'music'];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of files) {
  await cp(path.join(projectRoot, file), path.join(webDir, file));
}

for (const directory of directories) {
  await cp(path.join(projectRoot, directory), path.join(webDir, directory), { recursive: true });
}

await build({
  entryPoints: [path.join(projectRoot, 'location.js')],
  outfile: path.join(webDir, 'location.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
});

console.log(`Web app prepared in ${path.relative(projectRoot, webDir)}.`);
