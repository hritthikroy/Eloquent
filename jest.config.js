/**
 * Jest Configuration for Eloquent
 * Configured for multi-project execution of JavaScript and Go test suites via jest-go
 */

module.exports = {
  testEnvironment: 'node',
  verbose: true,
  projects: [
    {
      displayName: 'javascript',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/**/*.spec.js',
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/test/**/*.test.js'
      ],
      moduleFileExtensions: ['js', 'json', 'node']
    },
    {
      displayName: 'go',
      runner: 'jest-go',
      testMatch: [
        '<rootDir>/go-backend/**/*_test.go',
        '<rootDir>/backend-go/**/*_test.go'
      ]
    }
  ]
};
