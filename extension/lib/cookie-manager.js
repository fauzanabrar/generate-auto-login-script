/**
 * Cookie Manager
 * Handles cookie extraction using Chrome cookies API
 */

class CookieManager {
  /**
   * Get all cookies for a specific URL
   * @param {string} url - The URL to get cookies for
   * @returns {Promise<Array>} Array of cookie objects
   */
  async getCookies(url) {
    try {
      const cookies = await chrome.cookies.getAll({ url });
      return cookies;
    } catch (error) {
      console.error('Error getting cookies:', error);
      throw error;
    }
  }

  /**
   * Filter cookies by domain (including subdomains)
   * @param {Array} cookies - Array of cookie objects
   * @param {string} domain - Domain to filter by
   * @returns {Array} Filtered cookie array
   */
  filterCookiesByDomain(cookies, domain) {
    return cookies.filter(cookie => {
      return cookie.domain === domain || 
             cookie.domain === `.${domain}` ||
             domain.endsWith(cookie.domain);
    });
  }
}

// Export for use in background service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CookieManager;
}
