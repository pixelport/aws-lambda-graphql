module.exports = {
  projects: ['packages/*'],
  // Global configuration for Jest v29 and AWS SDK v3 compatibility
  testEnvironment: 'node',
  preset: 'ts-jest',
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
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    // Map node: prefixed imports to their standard equivalents for Jest
    '^node:(.*)$': '$1',
    // Mock all AWS SDK v3 packages to use our mocks
    '^@aws-sdk/(.*)$':
      '<rootDir>/packages/aws-lambda-graphql/src/__mocks__/aws-sdk.ts',
    '^@smithy/(.*)$':
      '<rootDir>/packages/aws-lambda-graphql/src/__mocks__/aws-sdk.ts',
  },
  transformIgnorePatterns: [
    // Allow transformation of AWS SDK packages if needed
    'node_modules/(?!((@aws-sdk|@smithy)/.*\\.js$))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
