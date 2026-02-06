import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'copy-extension-files',
      writeBundle() {
        // Copy manifest
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );

        // Copy styles
        if (!existsSync(resolve(__dirname, 'dist/src/panel'))) {
          mkdirSync(resolve(__dirname, 'dist/src/panel'), { recursive: true });
        }
        copyFileSync(
          resolve(__dirname, 'src/panel/styles.css'),
          resolve(__dirname, 'dist/src/panel/styles.css')
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
      input: {
        'src/background/index': resolve(__dirname, 'src/background/index.ts'),
        'src/content/index': resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        format: 'es',
      },
    },
    target: 'esnext',
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
});
