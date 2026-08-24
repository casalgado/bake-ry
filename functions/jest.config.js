module.exports = {
  testEnvironment: 'node',
  // Every suite calls clearFirestoreData(), which wipes the WHOLE emulator —
  // so two suites running in parallel delete each other's fixtures mid-test.
  // `npm test` already passes --runInBand; this makes a bare `npx jest` safe too.
  maxWorkers: 1,
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup/jest.setup.js',
  ],
};
