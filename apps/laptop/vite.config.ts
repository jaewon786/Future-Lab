import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig({
  // GitHub Pages 배포 시 pages.yml이 BASE_PATH=/<저장소>/laptop/ 를 넘긴다
  base: process.env.BASE_PATH ?? '/',
  build: {
    rolldownOptions: {
      input: {
        main: page('index.html'),
        practice: page('practice.html'),
        versus: page('versus.html'),
        link: page('spikes/link.html'),
        poseFps: page('spikes/pose-fps.html'),
        recorder: page('spikes/recorder.html'),
      },
    },
  },
});
