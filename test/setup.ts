// Test setup file
import { jest } from '@jest/globals';

// Set test timeout
jest.setTimeout(10000);

// Clear all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error
};
