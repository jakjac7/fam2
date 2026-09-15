import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function deploymentBasePath() {
  const configured = process.env.VITE_BASE_PATH?.trim();
  if (!configured || configured === '/') return '/';
  return `/${configured.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig(() => {
  return {
    // Firebase Hosting is served at /; GitHub Pages passes /fam2/ explicitly.
    base: deploymentBasePath(),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // The production bundle does not need a separate source-map artifact.
      sourcemap: false,
    },
  };
});
