const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    video: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    env: {
      apiBaseUrl: process.env.CYPRESS_API_BASE_URL || 'http://localhost:3000',
      username: process.env.CYPRESS_USERNAME || 'testuser@example.com',
      password: process.env.CYPRESS_PASSWORD || 'P@ssw0rd!123'
    }
  }
});
