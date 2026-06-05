/**
 * Firefox Background Script (MV2 Event Page)
 * All library code is bundled here since Firefox MV2 does not support importScripts
 * in event pages. Uses browser.* namespace (Promise-based) instead of chrome.*.
 */

// ─── Cookie Manager ──────────────────────────────────────────────────────────

class CookieManager {
  async getCookies(url) {
    try {
      return await browser.cookies.getAll({ url });
    } catch (error) {
      console.error('Error getting cookies:', error);
      throw error;
    }
  }

  filterCookiesByDomain(cookies, domain) {
    return cookies.filter(cookie =>
      cookie.domain === domain ||
      cookie.domain === `.${domain}` ||
      domain.endsWith(cookie.domain)
    );
  }
}

// ─── Storage Manager ─────────────────────────────────────────────────────────

class StorageManager {
  async getLocalStorage(tabId) {
    try {
      const response = await this.injectAndExtract(tabId);
      return response.localStorage || [];
    } catch (error) {
      console.error('Error getting localStorage:', error);
      throw error;
    }
  }

  async injectAndExtract(tabId) {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: () => {
          const items = [];
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key !== null) {
                items.push({ name: key, value: localStorage.getItem(key) });
              }
            }
          } catch (e) {
            console.error('Error extracting localStorage:', e);
          }
          return items;
        }
      });

      if (results && results[0] && results[0].result) {
        return { localStorage: results[0].result };
      }
      return { localStorage: [] };
    } catch (error) {
      if (error.message.includes('Cannot access')) {
        throw new Error('Failed to access tab content. The page may have Content Security Policy restrictions.');
      } else if (error.message.includes('permission')) {
        throw new Error('Insufficient permissions to access this tab.');
      }
      throw new Error(`Failed to inject content script: ${error.message}`);
    }
  }
}

// ─── Script Generator ────────────────────────────────────────────────────────

class ScriptGenerator {
  generate(authData) {
    if (!authData || typeof authData !== 'object') {
      throw new Error('Invalid authData: must be an object');
    }

    const hasCookies = authData.cookies && Array.isArray(authData.cookies) && authData.cookies.length > 0;
    const hasLocalStorage = authData.localStorage && Array.isArray(authData.localStorage) && authData.localStorage.length > 0;

    if (!hasCookies && !hasLocalStorage) {
      throw new Error('Invalid authData: must contain at least one cookie or localStorage item');
    }

    const parts = [this.generateCookieClear()];
    if (hasCookies) parts.push(this.generateCookieSet(authData.cookies));
    if (hasLocalStorage) parts.push(this.generateLocalStorageSet(authData.localStorage));

    return this.wrapInIIFE(parts.join('\n\n'));
  }

  generateCookieClear() {
    return `// Clear existing cookies
document.cookie.split(";").forEach(function(cookie) {
  document.cookie = cookie
    .replace(/^ +/, "")
    .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
});`;
  }

  generateCookieSet(cookies) {
    const lines = cookies.map(cookie => {
      const name = this._escapeString(cookie.name);
      const value = this._escapeString(cookie.value);
      let str = `${name}=${value}`;
      if (cookie.expires) str += `; expires=${new Date(cookie.expires * 1000).toUTCString()}`;
      if (cookie.path) str += `; path=${cookie.path}`;
      if (cookie.domain) str += `; domain=${cookie.domain}`;
      if (cookie.secure) str += `; secure`;
      if (cookie.sameSite) str += `; SameSite=${cookie.sameSite}`;
      return `document.cookie = "${str}";`;
    });
    return `// Set captured cookies\n${lines.join('\n')}`;
  }

  generateLocalStorageSet(items) {
    const lines = items.map(item =>
      `localStorage.setItem("${this._escapeString(item.name)}", "${this._escapeString(item.value)}");`
    );
    return `// Set localStorage items\n${lines.join('\n')}`;
  }

  _escapeString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\u0000/g, '\\0')
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, c =>
        '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')
      );
  }

  wrapInIIFE(code) {
    return `(function() {\n${code}\n})();`;
  }
}

// ─── Compressor ──────────────────────────────────────────────────────────────

class Compressor {
  compress(code) {
    const segments = this._tokenise(code);
    const compressed = segments.map((seg, i) =>
      i % 2 === 0 ? this._compressCode(seg) : seg
    ).join('');
    return compressed.trim();
  }

  _tokenise(source) {
    const segments = [];
    let i = 0;
    let codeStart = 0;

    while (i < source.length) {
      const ch = source[i];
      if (ch === '"' || ch === "'") {
        segments.push(source.slice(codeStart, i));
        const quote = ch;
        let j = i + 1;
        while (j < source.length) {
          if (source[j] === '\\') { j += 2; }
          else if (source[j] === quote) { j++; break; }
          else { j++; }
        }
        segments.push(source.slice(i, j));
        i = j;
        codeStart = i;
      } else {
        i++;
      }
    }
    segments.push(source.slice(codeStart));
    return segments;
  }

  _compressCode(code) {
    code = code.replace(/\/\/.*/g, '');
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/\s+/g, ' ');
    code = code.replace(/ *([\{\}()=,]) */g, '$1');
    return code;
  }

  getSize(code) {
    return new Blob([code]).size;
  }
}

// ─── Profile Manager ─────────────────────────────────────────────────────────

class ProfileManager {
  constructor() {
    this.storageKey = 'autologin_profiles';
    this.maxProfiles = 50;
  }

  async saveProfile(profile) {
    const profiles = await this.getAllProfiles();
    if (profiles.length >= this.maxProfiles) {
      throw new Error('Storage limit reached (50 profiles)');
    }
    const newProfile = {
      id: this.generateProfileId(),
      name: profile.name,
      domain: profile.domain,
      timestamp: Date.now(),
      authData: profile.authData
    };
    profiles.push(newProfile);
    await browser.storage.local.set({ [this.storageKey]: profiles });
    return newProfile;
  }

  async getAllProfiles() {
    const result = await browser.storage.local.get([this.storageKey]);
    return result[this.storageKey] || [];
  }

  async getProfile(profileId) {
    const profiles = await this.getAllProfiles();
    return profiles.find(p => p.id === profileId) || null;
  }

  async deleteProfile(profileId) {
    const profiles = await this.getAllProfiles();
    const filtered = profiles.filter(p => p.id !== profileId);
    if (filtered.length === profiles.length) return false;
    await browser.storage.local.set({ [this.storageKey]: filtered });
    return true;
  }

  async isStorageLimitReached() {
    const profiles = await this.getAllProfiles();
    return profiles.length >= this.maxProfiles;
  }

  generateProfileId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}

// ─── Background Service ───────────────────────────────────────────────────────

class BackgroundService {
  constructor() {
    this.cookieManager = new CookieManager();
    this.storageManager = new StorageManager();
    this.scriptGenerator = new ScriptGenerator();
    this.compressor = new Compressor();
    this.profileManager = new ProfileManager();
    this.init();
  }

  init() {
    // Firefox MV2: return a Promise from onMessage for async responses
    browser.runtime.onMessage.addListener((message, sender) => {
      return this.handleMessage(message, sender);
    });
    console.log('Firefox background script initialized');
  }

  async handleMessage(message, sender) {
    console.log('Received message:', message);
    try {
      switch (message.action) {
        case 'captureAuth': {
          const authData = await this.captureAuthData(message.tabId, message.url);
          return { success: true, authData };
        }
        case 'generateScript': {
          const scriptResult = await this.generateScript(message.authData);
          return { success: true, ...scriptResult };
        }
        case 'saveProfile': {
          const savedProfile = await this.saveProfile(message.profileName, message.authData, message.domain);
          return { success: true, profile: savedProfile };
        }
        case 'loadProfile': {
          const profile = await this.loadProfile(message.profileId);
          return { success: true, profile };
        }
        case 'deleteProfile': {
          const deleted = await this.deleteProfile(message.profileId);
          return { success: true, deleted };
        }
        case 'getAllProfiles': {
          const profiles = await this.getAllProfiles();
          return { success: true, profiles };
        }
        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error.message };
    }
  }

  async captureAuthData(tabId, url) {
    if (!this.isValidProtocol(url)) {
      throw new Error('Cannot capture data from this protocol. Only HTTP and HTTPS are supported.');
    }

    let cookies = [];
    let localStorage = [];
    const errors = [];

    try {
      cookies = await this.cookieManager.getCookies(url);
    } catch (error) {
      console.error('Cookie retrieval failed:', error);
      errors.push('Cookie retrieval failed');
    }

    try {
      localStorage = await this.storageManager.getLocalStorage(tabId);
    } catch (error) {
      console.error('localStorage retrieval failed:', error);
      errors.push('localStorage retrieval failed');
    }

    if (cookies.length === 0 && localStorage.length === 0) {
      const msg = errors.length > 0
        ? `No authentication data found. ${errors.join(', ')}.`
        : 'No authentication data found on this page.';
      throw new Error(msg);
    }

    return { cookies, localStorage, warnings: errors.length > 0 ? errors : undefined };
  }

  async generateScript(authData) {
    if (!authData || typeof authData !== 'object') {
      throw new Error('Invalid authentication data: must be an object');
    }
    const hasCookies = authData.cookies && Array.isArray(authData.cookies) && authData.cookies.length > 0;
    const hasLocalStorage = authData.localStorage && Array.isArray(authData.localStorage) && authData.localStorage.length > 0;
    if (!hasCookies && !hasLocalStorage) {
      throw new Error('Cannot generate script: authentication data is empty');
    }

    const script = this.scriptGenerator.generate(authData);
    const compressed = this.compressor.compress(script);
    const size = this.compressor.getSize(compressed);
    const originalSize = this.compressor.getSize(script);

    return { script, compressed, size, originalSize };
  }

  isValidProtocol(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async saveProfile(profileName, authData, domain) {
    if (!profileName || typeof profileName !== 'string' || profileName.trim() === '') {
      throw new Error('Profile name is required and must be a non-empty string');
    }
    if (!authData || typeof authData !== 'object') throw new Error('Invalid authentication data');
    if (!domain || typeof domain !== 'string') throw new Error('Domain is required');

    if (await this.profileManager.isStorageLimitReached()) {
      throw new Error('Storage limit reached (50 profiles). Please delete old profiles to save new ones.');
    }

    const saved = await this.profileManager.saveProfile({ name: profileName.trim(), domain, authData });
    console.log('Profile saved:', saved.id);
    return saved;
  }

  async loadProfile(profileId) {
    if (!profileId || typeof profileId !== 'string') throw new Error('Profile ID is required');
    const profile = await this.profileManager.getProfile(profileId);
    if (!profile) throw new Error('Profile not found. It may have been deleted.');
    return profile;
  }

  async deleteProfile(profileId) {
    if (!profileId || typeof profileId !== 'string') throw new Error('Profile ID is required');
    const deleted = await this.profileManager.deleteProfile(profileId);
    if (!deleted) throw new Error('Profile not found. It may have already been deleted.');
    return deleted;
  }

  async getAllProfiles() {
    return await this.profileManager.getAllProfiles();
  }
}

new BackgroundService();
