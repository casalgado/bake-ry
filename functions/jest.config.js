module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup/jest.setup.js',
  ],
};
