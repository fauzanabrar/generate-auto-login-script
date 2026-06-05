/**
 * Script Generator
 * Generates JavaScript IIFE from authentication data
 */

class ScriptGenerator {
  /**
   * Generate complete auto-login script
   * @param {Object} authData - Authentication data containing cookies and localStorage
   * @returns {string} Generated JavaScript code
   * @throws {Error} If authData is empty or invalid
   */
  generate(authData) {
    // Validate input
    if (!authData || typeof authData !== 'object') {
      throw new Error('Invalid authData: must be an object');
    }

    const hasCookies = authData.cookies && Array.isArray(authData.cookies) && authData.cookies.length > 0;
    const hasLocalStorage = authData.localStorage && Array.isArray(authData.localStorage) && authData.localStorage.length > 0;

    if (!hasCookies && !hasLocalStorage) {
      throw new Error('Invalid authData: must contain at least one cookie or localStorage item');
    }

    const parts = [];

    // Add cookie clearing code
    parts.push(this.generateCookieClear());

    // Add cookie setting code
    if (hasCookies) {
      parts.push(this.generateCookieSet(authData.cookies));
    }

    // Add localStorage setting code
    if (hasLocalStorage) {
      parts.push(this.generateLocalStorageSet(authData.localStorage));
    }

    const code = parts.join('\n\n');
    return this.wrapInIIFE(code);
  }

  /**
   * Generate cookie clearing code
   * @returns {string} Cookie clearing JavaScript
   */
  generateCookieClear() {
    return `// Clear existing cookies
document.cookie.split(";").forEach(function(cookie) {
  document.cookie = cookie
    .replace(/^ +/, "")
    .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
});`;
  }

  /**
   * Generate cookie setting code
   * @param {Array} cookies - Array of cookie objects
   * @returns {string} Cookie setting JavaScript
   */
  generateCookieSet(cookies) {
    const lines = cookies.map(cookie => {
      // Escape special characters in cookie name and value
      const escapedName = this._escapeString(cookie.name);
      const escapedValue = this._escapeString(cookie.value);
      let cookieStr = `${escapedName}=${escapedValue}`;
      
      if (cookie.expires) {
        const date = new Date(cookie.expires * 1000);
        cookieStr += `; expires=${date.toUTCString()}`;
      }
      
      if (cookie.path) {
        cookieStr += `; path=${cookie.path}`;
      }
      
      if (cookie.domain) {
        cookieStr += `; domain=${cookie.domain}`;
      }
      
      if (cookie.secure) {
        cookieStr += `; secure`;
      }
      
      if (cookie.sameSite) {
        cookieStr += `; SameSite=${cookie.sameSite}`;
      }
      
      return `document.cookie = "${cookieStr}";`;
    });

    return `// Set captured cookies\n${lines.join('\n')}`;
  }

  /**
   * Generate localStorage setting code
   * @param {Array} items - Array of localStorage items
   * @returns {string} localStorage setting JavaScript
   */
  generateLocalStorageSet(items) {
    const lines = items.map(item => {
      const key = this._escapeString(item.name);
      const value = this._escapeString(item.value);
      return `localStorage.setItem("${key}", "${value}");`;
    });

    return `// Set localStorage items\n${lines.join('\n')}`;
  }

  /**
   * Escape special characters in strings for use inside a JS double-quoted string literal.
   * Order matters: backslash must be escaped first.
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  _escapeString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')   // backslash first
      .replace(/"/g, '\\"')      // double quotes
      .replace(/\r/g, '\\r')     // carriage return
      .replace(/\n/g, '\\n')     // newline
      .replace(/\t/g, '\\t')     // tab
      .replace(/\u0000/g, '\\0') // null byte
      // Escape other ASCII control characters (0x01–0x1F except the ones above)
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, c =>
        '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')
      );
  }

  /**
   * Wrap code in IIFE
   * @param {string} code - The code to wrap
   * @returns {string} IIFE-wrapped code
   */
  wrapInIIFE(code) {
    return `(function() {\n${code}\n})();`;
  }
}

// Export for use in background service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScriptGenerator;
}
