// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hancock.us.com',
  markdown: {
    shikiConfig: { theme: 'github-dark' }
  }
});
