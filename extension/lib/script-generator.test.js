/**
 * Unit Tests for Script Generator
 */

const ScriptGenerator = require('./script-generator');

describe('ScriptGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ScriptGenerator();
  });

  describe('generate()', () => {
    it('should generate script with cookies only', () => {
      const authData = {
        cookies: [{
          name: 'session',
          value: 'abc123',
          domain: '.example.com',
          path: '/',
          expires: 1735689600,
          secure: true,
          sameSite: 'Lax'
        }],
        localStorage: []
      };

      const script = generator.generate(authData);
      
      expect(script).toContain('(function() {');
      expect(script).toContain('})();');
      expect(script).toContain('document.cookie.split');
      expect(script).toContain('session=abc123');
      expect(script).toContain('domain=.example.com');
      expect(script).toContain('secure');
      expect(script).toContain('SameSite=Lax');
    });

    it('should generate script with localStorage only', () => {
      const authData = {
        cookies: [],
        localStorage: [{
          name: 'token',
          value: 'xyz789'
        }]
      };

      const script = generator.generate(authData);
      
      expect(script).toContain('(function() {');
      expect(script).toContain('})();');
      expect(script).toContain('localStorage.setItem');
      expect(script).toContain('token');
      expect(script).toContain('xyz789');
    });

    it('should generate script with both cookies and localStorage', () => {
      const authData = {
        cookies: [{
          name: 'session',
          value: 'abc123',
          path: '/'
        }],
        localStorage: [{
          name: 'token',
          value: 'xyz789'
        }]
      };

      const script = generator.generate(authData);
      
      expect(script).toContain('document.cookie');
      expect(script).toContain('localStorage.setItem');
      expect(script).toContain('session=abc123');
      expect(script).toContain('token');
    });

    it('should throw error for empty authData', () => {
      const authData = {
        cookies: [],
        localStorage: []
      };

      expect(() => generator.generate(authData)).toThrow('Invalid authData: must contain at least one cookie or localStorage item');
    });

    it('should throw error for null authData', () => {
      expect(() => generator.generate(null)).toThrow('Invalid authData: must be an object');
    });

    it('should throw error for undefined authData', () => {
      expect(() => generator.generate(undefined)).toThrow('Invalid authData: must be an object');
    });

    it('should handle special characters in cookie values', () => {
      const authData = {
        cookies: [{
          name: 'data',
          value: 'value with "quotes" and \nnewlines\t and \\backslash',
          path: '/'
        }],
        localStorage: []
      };

      const script = generator.generate(authData);
      
      expect(script).toContain('\\"quotes\\"');
      expect(script).toContain('\\n');
      expect(script).toContain('\\t');
      expect(script).toContain('\\\\backslash');
    });

    it('should handle special characters in localStorage values', () => {
      const authData = {
        cookies: [],
        localStorage: [{
          name: 'key',
          value: 'value with "quotes" and \nnewlines\t and \\backslash'
        }]
      };

      const script = generator.generate(authData);
      
      expect(script).toContain('\\"quotes\\"');
      expect(script).toContain('\\n');
      expect(script).toContain('\\t');
      expect(script).toContain('\\\\backslash');
    });
  });

  describe('generateCookieClear()', () => {
    it('should generate cookie clearing code', () => {
      const clearCode = generator.generateCookieClear();
      
      expect(clearCode).toContain('document.cookie.split');
      expect(clearCode).toContain('expires=');
      expect(clearCode).toContain('new Date(0)');
    });
  });

  describe('generateCookieSet()', () => {
    it('should generate cookie setting code with all attributes', () => {
      const cookies = [{
        name: 'session',
        value: 'abc123',
        domain: '.example.com',
        path: '/admin',
        expires: 1735689600,
        secure: true,
        httpOnly: false,
        sameSite: 'Strict'
      }];

      const cookieCode = generator.generateCookieSet(cookies);
      
      expect(cookieCode).toContain('session=abc123');
      expect(cookieCode).toContain('domain=.example.com');
      expect(cookieCode).toContain('path=/admin');
      expect(cookieCode).toContain('expires=');
      expect(cookieCode).toContain('secure');
      expect(cookieCode).toContain('SameSite=Strict');
    });

    it('should handle cookies without optional attributes', () => {
      const cookies = [{
        name: 'simple',
        value: 'test'
      }];

      const cookieCode = generator.generateCookieSet(cookies);
      
      expect(cookieCode).toContain('simple=test');
      expect(cookieCode).not.toContain('domain=');
      expect(cookieCode).not.toContain('path=');
    });

    it('should escape special characters in cookie names and values', () => {
      const cookies = [{
        name: 'special',
        value: 'test"value\nwith\\chars',
        path: '/'
      }];

      const cookieCode = generator.generateCookieSet(cookies);
      
      expect(cookieCode).toContain('\\"');
      expect(cookieCode).toContain('\\n');
      expect(cookieCode).toContain('\\\\');
    });
  });

  describe('generateLocalStorageSet()', () => {
    it('should generate localStorage setting code', () => {
      const items = [
        { name: 'key1', value: 'value1' },
        { name: 'key2', value: 'value2' }
      ];

      const storageCode = generator.generateLocalStorageSet(items);
      
      expect(storageCode).toContain('localStorage.setItem');
      expect(storageCode).toContain('key1');
      expect(storageCode).toContain('value1');
      expect(storageCode).toContain('key2');
      expect(storageCode).toContain('value2');
    });

    it('should escape special characters in keys and values', () => {
      const items = [{
        name: 'key"with"quotes',
        value: 'value\nwith\nlines'
      }];

      const storageCode = generator.generateLocalStorageSet(items);
      
      expect(storageCode).toContain('\\"');
      expect(storageCode).toContain('\\n');
    });
  });

  describe('wrapInIIFE()', () => {
    it('should wrap code in IIFE', () => {
      const code = 'console.log("test");';
      const wrapped = generator.wrapInIIFE(code);
      
      expect(wrapped).toBe('(function() {\nconsole.log("test");\n})();');
    });
  });

  describe('_escapeString()', () => {
    it('should escape backslashes', () => {
      expect(generator._escapeString('test\\value')).toBe('test\\\\value');
    });

    it('should escape double quotes', () => {
      expect(generator._escapeString('test"value')).toBe('test\\"value');
    });

    it('should escape newlines', () => {
      expect(generator._escapeString('test\nvalue')).toBe('test\\nvalue');
    });

    it('should escape carriage returns', () => {
      expect(generator._escapeString('test\rvalue')).toBe('test\\rvalue');
    });

    it('should escape tabs', () => {
      expect(generator._escapeString('test\tvalue')).toBe('test\\tvalue');
    });

    it('should escape multiple special characters', () => {
      const input = 'test\\with"quotes\nand\ttabs\r';
      const expected = 'test\\\\with\\"quotes\\nand\\ttabs\\r';
      expect(generator._escapeString(input)).toBe(expected);
    });
  });
});
