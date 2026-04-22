import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  testIgnore: ['**/unit/**'],
  use: {
    baseURL: 'http://localhost:4000',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
