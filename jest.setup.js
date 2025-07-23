/* eslint-disable */
// Jest setup file to handle Node.js built-in modules and AWS SDK v3 compatibility

// Mock Node.js built-in modules that cause issues with AWS SDK v3
const mockNodeModules = {
  stream: require('stream'),
  util: require('util'),
  crypto: require('crypto'),
  fs: require('fs'),
  path: require('path'),
  url: require('url'),
  buffer: require('buffer'),
  events: require('events'),
  process: require('process'),
  os: require('os'),
  querystring: require('querystring'),
};

// Override module resolution for node: prefixed imports
const originalResolveFilename = require.resolve;
require.resolve = function (id, options) {
  if (id.startsWith('node:')) {
    const moduleName = id.slice(5); // Remove 'node:' prefix
    if (mockNodeModules[moduleName]) {
      return moduleName;
    }
  }
  return originalResolveFilename.call(this, id, options);
};

// Set up global mocks for problematic AWS SDK imports
global.mockStream = mockNodeModules.stream;
global.mockUtil = mockNodeModules.util;

// Prevent AWS SDK from trying to access browser-specific globals
global.window = undefined;
global.document = undefined;

// Mock crypto.webcrypto which AWS SDK v3 sometimes tries to access
if (!global.crypto) {
  global.crypto = mockNodeModules.crypto;
}

// Mock performance API that AWS SDK might use
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
  };
}

// Suppress console warnings from AWS SDK about missing browser APIs
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (
    message.includes('AWS SDK') ||
    message.includes('@aws-sdk') ||
    message.includes('@smithy') ||
    message.includes('node:')
  ) {
    return; // Suppress AWS SDK warnings
  }
  originalConsoleWarn.apply(console, args);
};