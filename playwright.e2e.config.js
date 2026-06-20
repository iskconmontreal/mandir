// Playwright E2E config: real goloka sandbox + Jekyll frontend
// FEATURE: tests — full-stack E2E test runner

import { defineConfig } from '@playwright/test'
import { BASE_CONFIG, makeGolakaConfig, GOLOKA_COMMON } from './playwright.common.js'

const { HASH } = GOLOKA_COMMON

const BOOTSTRAP_SQL = [
  "INSERT OR REPLACE INTO roles (id, role, permissions, permissions_default) VALUES",
  "(1, json_object('name','Administrator','description','Frontend E2E admin'), 'users:view,users:create,members:view,members:create,members:manage,income:view,income:create,expenses:view,expenses:create,expenses:approve,roles:update', 'users:view,users:create,members:view,members:create,members:manage,income:view,income:create,expenses:view,expenses:create,expenses:approve,roles:update'),",
  "(2, json_object('name','Treasurer','description','Frontend E2E treasurer'), 'income:view,income:create,income:delete,expenses:view,expenses:create,expenses:approve,members:view', 'income:view,income:create,income:delete,expenses:view,expenses:create,expenses:approve,members:view'),",
  "(4, json_object('name','Board Member','description','Frontend E2E approver'), 'income:view,expenses:approve,expenses:create,expenses:view,members:view,users:view', 'income:view,expenses:approve,expenses:create,expenses:view,members:view,users:view'),",
  "(5, json_object('name','Volunteer','description','Frontend E2E sevaka'), 'expenses:create', 'expenses:create'),",
  "(6, json_object('name','Viewer','description','Frontend E2E viewer'), 'expenses:view,expenses:create', 'expenses:view,expenses:create');",
  "DELETE FROM trusted_devices WHERE user_id IN (101,102,103,104,105);",
  "DELETE FROM user_roles WHERE user_id IN (101,102,103,104,105);",
  "DELETE FROM users WHERE id IN (101,102,103,104,105) OR email IN ('admin@test.local','treasurer@test.local','approver@test.local','viewer@test.local','sevaka@test.local');",
  `INSERT INTO users (id, public_id, email, password, meta, created_at, updated_at, archived, token_ver, login_attempts) VALUES
    (101, 'e2e-admin-001', 'admin@test.local', ${HASH}, json_object('name','Admin','email','admin@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (102, 'e2e-treasurer-001', 'treasurer@test.local', ${HASH}, json_object('name','Treasurer','email','treasurer@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (103, 'e2e-approver-001', 'approver@test.local', ${HASH}, json_object('name','Approver','email','approver@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (104, 'e2e-viewer-001', 'viewer@test.local', '', json_object('name','Viewer','email','viewer@test.local'), datetime('now'), datetime('now'), 0, 1, 0),
    (105, 'e2e-sevaka-001', 'sevaka@test.local', '', json_object('name','Volunteer','email','sevaka@test.local'), datetime('now'), datetime('now'), 0, 1, 0);`,
  "INSERT OR REPLACE INTO user_roles (user_id, role_id, created_at) VALUES (101, 1, datetime('now')), (102, 2, datetime('now')), (103, 4, datetime('now')), (104, 6, datetime('now')), (105, 5, datetime('now'));",
  "INSERT OR REPLACE INTO trusted_devices (user_id, device_id, label, last_used, created_at) VALUES (101, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (102, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (103, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (104, 'dev-device', 'Dev Machine', datetime('now'), datetime('now')), (105, 'dev-device', 'Dev Machine', datetime('now'), datetime('now'));",
]

const golokaServer = makeGolakaConfig({
  dir: '/tmp/goloka-e2e',
  port: 8081,
  env: ['OCR_STRATEGY=none'], // Disable OCR for faster tests
  bootstrapSql: BOOTSTRAP_SQL,
})

export default defineConfig({
  ...BASE_CONFIG,
  testMatch: /e2e.*\.spec/,
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  webServer: [
    ...BASE_CONFIG.webServer,
    golokaServer,
  ],
})
