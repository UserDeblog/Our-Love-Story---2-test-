import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(projectRoot, 'www');
const files = ['index.html', 'style.css', 'script.js', 'supabase-config.js'];
await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of files) {
  await cp(path.join(projectRoot, file), path.join(webDir, file));
}

const webImagesDir = path.join(webDir, 'images', 'web');
await mkdir(webImagesDir, { recursive: true });
await cp(path.join(projectRoot, 'images', 'web'), webImagesDir, { recursive: true });
await cp(path.join(projectRoot, 'images', 'background4.jpg'), path.join(webImagesDir, 'background4.jpg'));

console.log(`Web app prepared in ${path.relative(projectRoot, webDir)}.`);
