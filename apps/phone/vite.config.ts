import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig({
  // GitHub Pages 배포 시 pages.yml이 BASE_PATH=/<저장소>/phone/ 를 넘긴다
  base: process.env.BASE_PATH ?? '/',
  build: {
    rolldownOptions: {
      input: {
        main: page('index.html'),
        sensor: page('spikes/sensor.html'),
      },
    },
  },
});
