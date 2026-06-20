// Common Playwright configuration — shared base for all test runners
// FEATURE: tests — shared configuration utilities

export const BASE_CONFIG = {
  testDir: 'tests',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  use: { baseURL: 'http://localhost:4000' },
  webServer: [
    {
      command: 'bundle exec jekyll serve',
      url: 'http://localhost:4000',
      reuseExistingServer: !process.env.CI,
    },
  ],
}

export const GOLOKA_COMMON = {
  BIN_NAME: 'goloka',
  GOLOKA_PATH: process.cwd() + '/../goloka',
  HASH: "char(36) || '2a' || char(36) || '10' || char(36) || 'NZBaDt9GfmUHN6FYuWtNL.hAMs4ZZy4szhlymPdHY/TIsQZ3/ghxC'",
  COMMON_ENV: [
    'ENVIRONMENT=development',
    'JWT_SECRET=e2e-test-secret-minimum-32-characters-long',
    'ALLOWED_ORIGINS=http://localhost:4000',
  ],
}

export function makeGolokaConfig({ dir, port, env = {}, bootstrapSql = [] }) {
  const { BIN_NAME, GOLOKA_PATH, HASH, COMMON_ENV } = GOLOKA_COMMON
  const bin = `${dir}/${BIN_NAME}`

  const dbPaths = [
    `DB_PATH=${dir}/app.db`,
    `FINANCE_DB_PATH=${dir}/fin.db`,
    `COMMUNITY_DB_PATH=${dir}/community.db`,
  ]

  const fullEnv = [
    ...COMMON_ENV,
    `GOLOKA_PATH=${GOLOKA_PATH}`,
    `GOLOKA_PUBLIC_PATH=${GOLOKA_PATH}/public`,
    ...dbPaths,
    `PORT=${port}`,
    ...env,
  ].join(' ')

  const build = `cd ${GOLOKA_PATH} && CGO_ENABLED=1 go build -tags devtools -o ${bin} ./cmd/goloka`
  const bootstrap = bootstrapSql.length ? `&& sqlite3 ${dir}/app.db "${bootstrapSql.join(' ')}"` : ''
  const setup = `rm -rf ${dir} && mkdir -p ${dir} && ${build} && cd ${dir} && ${fullEnv} ${BIN_NAME} seed${bootstrap} && ${fullEnv} ${BIN_NAME} serve`

  return {
    command: setup,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  }
}
