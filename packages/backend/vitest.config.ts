import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    globals: false,
    pool: 'forks',
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/devrelay',
      JWT_SECRET: 'dev-secret-change-in-production',
      JWT_REFRESH_SECRET: 'dev-refresh-secret-change-in-production',
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
      GITHUB_CLIENT_ID: 'test-github-client-id',
      GITHUB_CLIENT_SECRET: 'test-github-client-secret',
      SLACK_CLIENT_ID: 'test-slack-client-id',
      SLACK_CLIENT_SECRET: 'test-slack-client-secret',
      NODE_ENV: 'test',
    },
  },
})
