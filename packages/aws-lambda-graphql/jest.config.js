module.exports = {
  displayName: 'aws-lambda-graphql',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/src/__mocks__/aws-sdk.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          target: 'es2020',
          module: 'commonjs',
          strict: false,
          noImplicitAny: false,
          strictNullChecks: false,
        },
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    // Map node: prefixed imports to their standard equivalents for Jest
    '^node:(.*)$': '$1',
    // Mock all AWS SDK v3 packages to use our mocks
    '^@aws-sdk/(.*)$': '<rootDir>/src/__mocks__/aws-sdk.ts',
    '^@smithy/(.*)$': '<rootDir>/src/__mocks__/aws-sdk.ts',
  },
  transformIgnorePatterns: [
    // Allow transformation of AWS SDK packages if needed
    'node_modules/(?!((@aws-sdk|@smithy)/.*\\.js$))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
