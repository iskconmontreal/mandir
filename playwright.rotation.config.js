// Playwright config: JWT rotation tests with 10s token expiry
// FEATURE: tests — short-lived JWT rotation verification

import { defineConfig } from '@playwright/test'

const DIR = '/tmp/goloka-rotation'
const BIN = `${DIR}/goloka`
const GOLOKA = process.cwd() + '/../goloka'
const ENV = [
  'ENVIRONMENT=development',
  `GOLOKA_PATH=${GOLOKA}`,
  `GOLOKA_PUBLIC_PATH=${GOLOKA}/public`,
  `DB_PATH=${DIR}/app.db`,
  `FINANCE_DB_PATH=${DIR}/fin.db`,
  `COMMUNITY_DB_PATH=${DIR}/community.db`,
  'JWT_SECRET=e2e-test-secret-minimum-32-characters-long',
  'ALLOWED_ORIGINS=http://localhost:4000',
  'PORT=8082',
  'JWT_EXPIRY=10s',
].join(' ')

const BUILD = `cd ${GOLOKA} && CGO_ENABLED=1 go build -o ${BIN} ./cmd/goloka`
const SETUP = `rm -rf ${DIR} && mkdir -p ${DIR} && ${BUILD} && cd ${DIR} && ${ENV} ${BIN} seed && ${ENV} ${BIN} serve`

export default defineConfig({
  testDir: 'tests',
  testMatch: /rotation\.spec/,
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4000' },
  webServer: [
    {
      command: 'bundle exec jekyll serve',
      url: 'http://localhost:4000',
      reuseExistingServer: true,
    },
    {
      command: SETUP,
      url: 'http://localhost:8082/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
