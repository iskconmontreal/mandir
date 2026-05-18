// Playwright E2E config: real goloka sandbox + Jekyll frontend
// FEATURE: tests — full-stack E2E test runner

import { defineConfig } from '@playwright/test'

const DIR = '/tmp/goloka-e2e'
const BIN = `${DIR}/goloka`
const GOLOKA = process.cwd() + '/../goloka'
const HASH = "char(36) || '2a' || char(36) || '10' || char(36) || 'NZBaDt9GfmUHN6FYuWtNL.hAMs4ZZy4szhlymPdHY/TIsQZ3/ghxC'"
const ENV = [
  'ENVIRONMENT=development',
  `GOLOKA_PATH=${GOLOKA}`,
  `GOLOKA_PUBLIC_PATH=${GOLOKA}/public`,
  `DB_PATH=${DIR}/app.db`,
  `FINANCE_DB_PATH=${DIR}/fin.db`,
  `COMMUNITY_DB_PATH=${DIR}/community.db`,
  'JWT_SECRET=e2e-test-secret-minimum-32-characters-long',
  'ALLOWED_ORIGINS=http://localhost:4000',
  'PORT=8081',
  // Disable OCR: real extraction runs a 16s Apple Vision/Ollama pass per
  // receipt, which hangs the server under parallel upload load. Uploads
  // still decode + WebP-convert; only the slow text extraction is skipped.
  'OCR_STRATEGY=none',
].join(' ')

const BUILD = `cd ${GOLOKA} && CGO_ENABLED=1 go build -tags devtools -o ${BIN} ./cmd/goloka`
const BOOTSTRAP_SQL = [
  `INSERT OR REPLACE INTO roles (id, role, permissions, permissions_default) VALUES
    (1, json_object('name','Administrator','description','Frontend E2E admin'), 'users:view,users:create,members:view,members:create,members:manage,income:view,income:create,expenses:view,expenses:create,expenses:approve,roles:update', 'users:view,users:create,members:view,members:create,members:manage,income:view,income:create,expenses:view,expenses:create,expenses:approve,roles:update'),
    (2, json_object('name','Treasurer','description','Frontend E2E treasurer'), 'income:view,income:create,income:delete,expenses:view,expenses:create,expenses:approve,members:view', 'income:view,income:create,income:delete,expenses:view,expenses:create,expenses:approve,members:view'),
    (4, json_object('name','Board Member','description','Frontend E2E approver'), 'income:view,expenses:approve,expenses:create,expenses:view,members:view,users:view', 'income:view,expenses:approve,expenses:create,expenses:view,members:view,users:view'),
    (5, json_object('name','Volunteer','description','Frontend E2E sevaka'), 'expenses:create', 'expenses:create'),
    (6, json_object('name','Viewer','description','Frontend E2E viewer'), 'expenses:view,expenses:create', 'expenses:view,expenses:create');`,
  `DELETE FROM trusted_devices WHERE user_id IN (101,102,103,104,105);`,
  `DELETE FROM user_roles WHERE user_id IN (101,102,103,104,105);`,
  `DELETE FROM users WHERE id IN (101,102,103,104,105) OR email IN ('admin@test.local','treasurer@test.local','approver@test.local','viewer@test.local','sevaka@test.local');`,
  `INSERT INTO users (id, public_id, email, password, meta, created_at, updated_at, archived, token_ver, login_attempts) VALUES
    (101, 'e2e-admin-001', 'admin@test.local', ${HASH}, json_object('name','Admin','email','admin@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (102, 'e2e-treasurer-001', 'treasurer@test.local', ${HASH}, json_object('name','Treasurer','email','treasurer@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (103, 'e2e-approver-001', 'approver@test.local', ${HASH}, json_object('name','Approver','email','approver@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (104, 'e2e-viewer-001', 'viewer@test.local', '', json_object('name','Viewer','email','viewer@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (105, 'e2e-sevaka-001', 'sevaka@test.local', '', json_object('name','Volunteer','email','sevaka@test.local'), datetime('now'), datetime('now'), 0, 1, 0);`,
  `INSERT OR REPLACE INTO user_roles (user_id, role_id, created_at) VALUES (101, 1, datetime('now')), (102, 2, datetime('now')), (103, 4, datetime('now')), (104, 6, datetime('now')), (105, 5, datetime('now'));`,
  `INSERT OR REPLACE INTO trusted_devices (user_id, device_id, label, last_used, created_at) VALUES (101, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (102, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (103, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (104, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (105, 'dev-device', 'Dev Machine', datetime('now'), datetime('now'));`,
].join(' ')
const BOOTSTRAP = `sqlite3 ${DIR}/app.db "${BOOTSTRAP_SQL}"`
const COMMUNITY_BOOTSTRAP_SQL = [
  `DELETE FROM members WHERE user_id IN (101,102,103,104,105);`,
  `INSERT INTO members (public_id, user_id, data, created_at, updated_at, archived) VALUES
    ('e2e-member-admin-001', 101, json_object('name','Admin','email','admin@test.local'), datetime('now'), datetime('now'), 0),
    ('e2e-member-treasurer-001', 102, json_object('name','Treasurer','email','treasurer@test.local'), datetime('now'), datetime('now'), 0),
    ('e2e-member-approver-001', 103, json_object('name','Approver','email','approver@test.local'), datetime('now'), datetime('now'), 0),
    ('e2e-member-viewer-001', 104, json_object('name','Viewer','email','viewer@test.local'), datetime('now'), datetime('now'), 0),
    ('e2e-member-sevaka-001', 105, json_object('name','Volunteer','email','sevaka@test.local'), datetime('now'), datetime('now'), 0);`,
].join(' ')
const BOOTSTRAP_COMMUNITY = `sqlite3 ${DIR}/community.db "${COMMUNITY_BOOTSTRAP_SQL}"`
const SETUP = `rm -rf ${DIR} && mkdir -p ${DIR} && ${BUILD} && cd ${DIR} && ${ENV} ${BIN} seed && ${BOOTSTRAP} && ${BOOTSTRAP_COMMUNITY} && ${ENV} ${BIN} serve`

export default defineConfig({
  testDir: 'tests',
  testMatch: /e2e.*\.spec/,
  fullyParallel: true,
  workers: 4,
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
      url: 'http://localhost:8081/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
