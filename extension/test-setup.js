/**
 * Jest Test Setup
 * Sets up the test environment with mocks for Chrome APIs
 */

// Mock Chrome APIs
global.chrome = {
  cookies: {
    getAll: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  }
};

// Mock Blob for size calculations
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
  }
};
