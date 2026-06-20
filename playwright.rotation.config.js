// Playwright config: JWT rotation tests with 10s token expiry
// FEATURE: tests — short-lived JWT rotation verification

import { defineConfig } from '@playwright/test'
import { BASE_CONFIG, makeGolakaConfig, GOLOKA_COMMON } from './playwright.common.js'

const { HASH } = GOLOKA_COMMON

const BOOTSTRAP_SQL = [
  "INSERT OR REPLACE INTO roles (id, role, permissions, permissions_default) VALUES (1, json_object('name','Administrator','description','Frontend rotation admin'), 'users:view,users:create,members:view,members:create,members:manage,income:view,income:create,expenses:view,expenses:create,expenses:approve,roles:update', 'users:view,users:create,members:view,members:create,members:manage,income:view,income:create,expenses:view,expenses:create,expenses:approve,roles:update');",
  "DELETE FROM trusted_devices WHERE user_id = 101;",
  "DELETE FROM user_roles WHERE user_id = 101;",
  "DELETE FROM users WHERE id = 101 OR email = 'admin@test.local';",
  `INSERT INTO users (id, public_id, email, password, meta, created_at, updated_at, archived, token_ver, login_attempts) VALUES (101, 'rotation-admin-001', 'admin@test.local', ${HASH}, json_object('name','Admin','email','admin@test.local'), datetime('now'), datetime('now'), 0, 1, 0);`,
  "INSERT OR REPLACE INTO user_roles (user_id, role_id, created_at) VALUES (101, 1, datetime('now'));",
  "INSERT OR REPLACE INTO trusted_devices (user_id, device_id, label, last_used, created_at) VALUES (101, 'dev-device', 'Dev Machine', datetime('now'), datetime('now'));",
]

const rotationServer = makeGolakaConfig({
  dir: '/tmp/goloka-rotation',
  port: 8082,
  env: ['JWT_EXPIRY=10s'],
  bootstrapSql: BOOTSTRAP_SQL,
})

export default defineConfig({
  ...BASE_CONFIG,
  testMatch: /rotation\.spec/,
  timeout: 60_000,
  webServer: [
    ...BASE_CONFIG.webServer,
    rotationServer,
  ],
})
