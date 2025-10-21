import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@common': resolve(__dirname, 'src/common'),
      },
    },
    build: {
      rollupOptions: {
        external: [
          'express', 'cors', 'fs', 'path', 'http', 'https',
          'axios', 'serialport', 'oracledb', 'mqtt',
          'fast-xml-parser', 'mssql', 'xml2js',
        ],
      },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@utils': resolve(__dirname, 'src/renderer/utils'),
        '@common': resolve(__dirname, 'src/common'),
      },
    },
  },

  renderer: {
    plugins: [react()],
    publicDir: resolve(__dirname, 'public'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@pages': resolve(__dirname, 'src/renderer/pages'),
        '@utils': resolve(__dirname, 'src/renderer/utils'),
        '@common': resolve(__dirname, 'src/common'),
        '@resources': resolve(__dirname, 'src/renderer/resources'),
      },
    },
    assetsInclude: ['**/*.png', '**/*.jpg', '**/*.svg'],

  },
});
