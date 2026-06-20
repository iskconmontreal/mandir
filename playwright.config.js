// Playwright config: main test runner (unit tests, no backend)
// FEATURE: tests — fast unit/feature tests without backend

import { defineConfig } from '@playwright/test'
import { BASE_CONFIG } from './playwright.common.js'

export default defineConfig({
  ...BASE_CONFIG,
  testIgnore: ['**/unit/**', '**/e2e.*', '**/rotation.*'],
})
