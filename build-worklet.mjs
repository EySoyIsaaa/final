import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await esbuild.build({
  entryPoints: [join(__dirname, 'client/src/worklets/epicenter-worklet.ts')],
  bundle: false,
  outfile: join(__dirname, 'client/public/epicenter-worklet.js'),
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
});

console.log('✓ Worklet built successfully');
