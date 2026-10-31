import { build, preview } from 'vite';
import { resolve } from 'node:path';

// Compile the exact application components with the existing production plugins.
await build({
  configFile: resolve('vite.config.ts'),
  build: { outDir: '.taste-skill/build', target: 'esnext', rolldownOptions: { input: resolve('.scratch/windows-workbench/index.html') } },
});
if (!process.argv.includes('--build-only')) {
  const server = await preview({ configFile: false, build: { outDir: '.taste-skill/build' }, preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
  server.printUrls();
}
