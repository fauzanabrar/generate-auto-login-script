/**
 * Storage Manager
 * Coordinates localStorage extraction via content script
 */

class StorageManager {
  /**
   * Get localStorage from a specific tab
   * @param {number} tabId - The tab ID to get localStorage from
   * @returns {Promise<Array>} Array of localStorage items
   */
  async getLocalStorage(tabId) {
    try {
      const response = await this.injectAndExtract(tabId);
      return response.localStorage || [];
    } catch (error) {
      console.error('Error getting localStorage:', error);
      throw error;
    }
  }

  /**
   * Inject content script and retrieve data
   * @param {number} tabId - The tab ID to inject into
   * @returns {Promise<Object>} Response from content script
   */
  async injectAndExtract(tabId) {
    try {
      // Inject script to extract localStorage from the tab's context
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const items = [];
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key !== null) {
                items.push({
                  name: key,
                  value: localStorage.getItem(key)
                });
              }
            }
          } catch (error) {
            console.error('Error extracting localStorage:', error);
          }
          return items;
        }
      });

      // Extract the result from the first frame
      if (results && results[0] && results[0].result) {
        return { localStorage: results[0].result };
      } else {
        return { localStorage: [] };
      }
    } catch (error) {
      // Handle content script injection errors (CSP, permissions, etc.)
      if (error.message.includes('Cannot access')) {
        throw new Error('Failed to access tab content. The page may have Content Security Policy restrictions.');
      } else if (error.message.includes('permission')) {
        throw new Error('Insufficient permissions to access this tab.');
      } else {
        throw new Error(`Failed to inject content script: ${error.message}`);
      }
    }
  }
}

// Export for use in background service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
