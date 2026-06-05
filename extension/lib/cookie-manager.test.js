/**
 * Unit Tests for Cookie Manager
 * Tests cookie extraction and domain filtering
 */

const CookieManager = require('./cookie-manager.js');

describe('CookieManager', () => {
  let cookieManager;

  beforeEach(() => {
    cookieManager = new CookieManager();
    jest.clearAllMocks();
  });

  describe('getCookies', () => {
    test('should retrieve cookies with all attributes', async () => {
      const mockCookies = [
        {
          name: 'session',
          value: 'abc123',
          domain: '.example.com',
          path: '/',
          expires: 1735689600,
          secure: true,
          httpOnly: true,
          sameSite: 'Lax'
        },
        {
          name: 'token',
          value: 'xyz789',
          domain: 'example.com',
          path: '/api',
          expires: 1735689600,
          secure: false,
          httpOnly: false,
          sameSite: 'None'
        }
      ];

      chrome.cookies.getAll.mockResolvedValue(mockCookies);

      const result = await cookieManager.getCookies('https://example.com');

      expect(chrome.cookies.getAll).toHaveBeenCalledWith({ url: 'https://example.com' });
      expect(result).toEqual(mockCookies);
      expect(result[0]).toHaveProperty('name', 'session');
      expect(result[0]).toHaveProperty('value', 'abc123');
      expect(result[0]).toHaveProperty('domain', '.example.com');
      expect(result[0]).toHaveProperty('path', '/');
      expect(result[0]).toHaveProperty('expires', 1735689600);
      expect(result[0]).toHaveProperty('secure', true);
      expect(result[0]).toHaveProperty('httpOnly', true);
      expect(result[0]).toHaveProperty('sameSite', 'Lax');
    });

    test('should handle cookies with special characters in values', async () => {
      const mockCookies = [
        {
          name: 'data',
          value: 'value with spaces and "quotes"',
          domain: 'example.com',
          path: '/',
          expires: 1735689600,
          secure: false,
          httpOnly: false,
          sameSite: 'Strict'
        }
      ];

      chrome.cookies.getAll.mockResolvedValue(mockCookies);

      const result = await cookieManager.getCookies('https://example.com');

      expect(result[0].value).toBe('value with spaces and "quotes"');
    });

    test('should throw error when chrome.cookies.getAll fails', async () => {
      const error = new Error('Cookie API error');
      chrome.cookies.getAll.mockRejectedValue(error);

      await expect(cookieManager.getCookies('https://example.com'))
        .rejects.toThrow('Cookie API error');
    });

    test('should return empty array when no cookies exist', async () => {
      chrome.cookies.getAll.mockResolvedValue([]);

      const result = await cookieManager.getCookies('https://example.com');

      expect(result).toEqual([]);
    });
  });

  describe('filterCookiesByDomain', () => {
    test('should filter cookies for exact domain match', () => {
      const cookies = [
        { name: 'cookie1', domain: 'example.com' },
        { name: 'cookie2', domain: 'other.com' },
        { name: 'cookie3', domain: 'example.com' }
      ];

      const result = cookieManager.filterCookiesByDomain(cookies, 'example.com');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('cookie1');
      expect(result[1].name).toBe('cookie3');
    });

    test('should filter cookies for subdomain with dot prefix (.example.com)', () => {
      const cookies = [
        { name: 'cookie1', domain: '.example.com' },
        { name: 'cookie2', domain: 'other.com' },
        { name: 'cookie3', domain: 'example.com' }
      ];

      const result = cookieManager.filterCookiesByDomain(cookies, 'example.com');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('cookie1');
      expect(result[1].name).toBe('cookie3');
    });

    test('should filter cookies when domain ends with cookie domain', () => {
      const cookies = [
        { name: 'cookie1', domain: '.example.com' },
        { name: 'cookie2', domain: '.other.com' }
      ];

      const result = cookieManager.filterCookiesByDomain(cookies, 'sub.example.com');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cookie1');
    });

    test('should return empty array when no cookies match domain', () => {
      const cookies = [
        { name: 'cookie1', domain: 'example.com' },
        { name: 'cookie2', domain: 'other.com' }
      ];

      const result = cookieManager.filterCookiesByDomain(cookies, 'nomatch.com');

      expect(result).toEqual([]);
    });

    test('should handle empty cookie array', () => {
      const result = cookieManager.filterCookiesByDomain([], 'example.com');

      expect(result).toEqual([]);
    });
  });
});
