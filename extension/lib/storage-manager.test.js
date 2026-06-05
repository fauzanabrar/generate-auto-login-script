/**
 * Unit Tests for Storage Manager
 * Tests localStorage extraction via content script injection
 */

const StorageManager = require('./storage-manager.js');

describe('StorageManager', () => {
  let storageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
    jest.clearAllMocks();
  });

  describe('getLocalStorage', () => {
    test('should retrieve localStorage items with specific tab ID', async () => {
      const mockLocalStorageItems = [
        { name: 'token', value: 'abc123' },
        { name: 'userId', value: '456' }
      ];

      chrome.scripting.executeScript.mockResolvedValue([
        { result: mockLocalStorageItems }
      ]);

      const result = await storageManager.getLocalStorage(123);

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        func: expect.any(Function)
      });
      expect(result).toEqual(mockLocalStorageItems);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name', 'token');
      expect(result[0]).toHaveProperty('value', 'abc123');
    });

    test('should handle empty localStorage', async () => {
      chrome.scripting.executeScript.mockResolvedValue([
        { result: [] }
      ]);

      const result = await storageManager.getLocalStorage(123);

      expect(result).toEqual([]);
    });

    test('should handle CSP errors with user-friendly message', async () => {
      const error = new Error('Cannot access contents of url');
      chrome.scripting.executeScript.mockRejectedValue(error);

      await expect(storageManager.getLocalStorage(123))
        .rejects.toThrow('Failed to access tab content. The page may have Content Security Policy restrictions.');
    });

    test('should handle permission errors with user-friendly message', async () => {
      const error = new Error('User denied permission to access the tab');
      chrome.scripting.executeScript.mockRejectedValue(error);

      await expect(storageManager.getLocalStorage(123))
        .rejects.toThrow('Insufficient permissions to access this tab.');
    });

    test('should handle generic injection errors', async () => {
      const error = new Error('Unknown error');
      chrome.scripting.executeScript.mockRejectedValue(error);

      await expect(storageManager.getLocalStorage(123))
        .rejects.toThrow('Failed to inject content script: Unknown error');
    });

    test('should handle localStorage with large values', async () => {
      const largeValue = 'x'.repeat(1000000); // ~1MB
      const mockLocalStorageItems = [
        { name: 'largeData', value: largeValue }
      ];

      chrome.scripting.executeScript.mockResolvedValue([
        { result: mockLocalStorageItems }
      ]);

      const result = await storageManager.getLocalStorage(123);

      expect(result).toHaveLength(1);
      expect(result[0].value.length).toBe(1000000);
    });

    test('should handle null results from executeScript', async () => {
      chrome.scripting.executeScript.mockResolvedValue([{}]);

      const result = await storageManager.getLocalStorage(123);

      expect(result).toEqual([]);
    });

    test('should handle empty results array from executeScript', async () => {
      chrome.scripting.executeScript.mockResolvedValue([]);

      const result = await storageManager.getLocalStorage(123);

      expect(result).toEqual([]);
    });
  });

  describe('injectAndExtract', () => {
    test('should inject content script and extract localStorage', async () => {
      const mockLocalStorageItems = [
        { name: 'key1', value: 'value1' },
        { name: 'key2', value: 'value2' }
      ];

      chrome.scripting.executeScript.mockResolvedValue([
        { result: mockLocalStorageItems }
      ]);

      const result = await storageManager.injectAndExtract(456);

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 456 },
        func: expect.any(Function)
      });
      expect(result).toEqual({ localStorage: mockLocalStorageItems });
    });

    test('should return empty localStorage when result is undefined', async () => {
      chrome.scripting.executeScript.mockResolvedValue([{ result: undefined }]);

      const result = await storageManager.injectAndExtract(456);

      expect(result).toEqual({ localStorage: [] });
    });

    test('should throw formatted error for CSP restrictions', async () => {
      const error = new Error('Cannot access contents of the page');
      chrome.scripting.executeScript.mockRejectedValue(error);

      await expect(storageManager.injectAndExtract(456))
        .rejects.toThrow('Failed to access tab content. The page may have Content Security Policy restrictions.');
    });

    test('should throw formatted error for permission issues', async () => {
      const error = new Error('User denied permission to access');
      chrome.scripting.executeScript.mockRejectedValue(error);

      await expect(storageManager.injectAndExtract(456))
        .rejects.toThrow('Insufficient permissions to access this tab.');
    });

    test('should propagate generic errors with context', async () => {
      const error = new Error('Network timeout');
      chrome.scripting.executeScript.mockRejectedValue(error);

      await expect(storageManager.injectAndExtract(456))
        .rejects.toThrow('Failed to inject content script: Network timeout');
    });
  });
});
