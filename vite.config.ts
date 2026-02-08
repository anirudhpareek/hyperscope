import { defineConfig, build } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';

// Build a script as IIFE (self-contained, no imports)
async function buildScript(entry: string, outDir: string, name: string) {
  await build({
    configFile: false,
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, entry),
        name,
        formats: ['iife'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
      minify: false,
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
      },
    },
    plugins: [preact()],
    logLevel: 'warn',
  });
}

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'build-extension',
      async closeBundle() {
        // Build background script as IIFE
        await buildScript('src/background/index.ts', 'dist/src/background', 'HLBackground');

        // Build sidepanel as IIFE
        await buildScript('src/sidepanel/index.tsx', 'dist', 'HLSidePanel');
      },
    },
    {
      name: 'copy-extension-files',
      writeBundle() {
        // Copy manifest
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );

        // Copy sidepanel HTML
        const sidepanelHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HL Analytics</title>
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div id="app"></div>
  <script src="index.js"></script>
</body>
</html>`;
        writeFileSync(resolve(__dirname, 'dist/sidepanel.html'), sidepanelHtml);

        // Copy sidepanel styles
        copyFileSync(
          resolve(__dirname, 'src/sidepanel/styles.css'),
          resolve(__dirname, 'dist/sidepanel.css')
        );

        // Copy icons
        if (!existsSync(resolve(__dirname, 'dist/public/icons'))) {
          mkdirSync(resolve(__dirname, 'dist/public/icons'), { recursive: true });
        }
        ['icon16.png', 'icon48.png', 'icon128.png'].forEach((icon) => {
          const src = resolve(__dirname, 'public/icons', icon);
          if (existsSync(src)) {
            copyFileSync(src, resolve(__dirname, 'dist/public/icons', icon));
          }
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/background/index.ts'),
      output: {
        entryFileNames: 'dummy.js',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
