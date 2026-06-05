/**
 * Background Service Worker
 * Coordinates data capture operations and manages communication between popup and content scripts
 */

// Import required classes using importScripts (for Manifest V3 service workers)
importScripts(
  '../lib/cookie-manager.js',
  '../lib/storage-manager.js',
  '../lib/script-generator.js',
  '../lib/compressor.js',
  '../utils/storage.js'
);

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
    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      // Return true to indicate async response
      return true;
    });

    console.log('Background service worker initialized');
  }

  /**
   * Handle messages from popup and content scripts
   * @param {Object} message - The message object
   * @param {Object} sender - The message sender
   * @param {Function} sendResponse - Function to send response
   */
  async handleMessage(message, sender, sendResponse) {
    console.log('Received message:', message);

    try {
      switch (message.action) {
        case 'captureAuth':
          const authData = await this.captureAuthData(message.tabId, message.url);
          sendResponse({ success: true, authData });
          break;

        case 'generateScript':
          const scriptResult = await this.generateScript(message.authData);
          sendResponse({ success: true, ...scriptResult });
          break;

        case 'saveProfile':
          const savedProfile = await this.saveProfile(message.profileName, message.authData, message.domain);
          sendResponse({ success: true, profile: savedProfile });
          break;

        case 'loadProfile':
          const loadedProfile = await this.loadProfile(message.profileId);
          sendResponse({ success: true, profile: loadedProfile });
          break;

        case 'deleteProfile':
          const deleted = await this.deleteProfile(message.profileId);
          sendResponse({ success: true, deleted });
          break;

        case 'getAllProfiles':
          const profiles = await this.getAllProfiles();
          sendResponse({ success: true, profiles });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Capture authentication data from active tab
   * @param {number} tabId - The tab ID to capture from
   * @param {string} url - The tab URL
   * @returns {Promise<Object>} Auth data containing cookies and localStorage
   */
  async captureAuthData(tabId, url) {
    // Validate URL protocol
    if (!this.isValidProtocol(url)) {
      throw new Error('Cannot capture data from this protocol. Only HTTP and HTTPS are supported.');
    }

    let cookies = [];
    let localStorage = [];
    const errors = [];

    // Try to get cookies with graceful degradation
    try {
      cookies = await this.cookieManager.getCookies(url);
      console.log(`Captured ${cookies.length} cookies`);
    } catch (error) {
      console.error('Cookie retrieval failed:', error);
      errors.push('Cookie retrieval failed');
      // Continue with localStorage
    }

    // Try to get localStorage with graceful degradation
    try {
      localStorage = await this.storageManager.getLocalStorage(tabId);
      console.log(`Captured ${localStorage.length} localStorage items`);
    } catch (error) {
      console.error('localStorage retrieval failed:', error);
      errors.push('localStorage retrieval failed');
      // Continue with cookies
    }

    // Check if we got any data at all
    if (cookies.length === 0 && localStorage.length === 0) {
      const errorMsg = errors.length > 0 
        ? `No authentication data found. ${errors.join(', ')}.`
        : 'No authentication data found on this page.';
      throw new Error(errorMsg);
    }

    // Return captured data (even if only one source succeeded)
    return {
      cookies,
      localStorage,
      warnings: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Generate auto-login script from authentication data
   * @param {Object} authData - Authentication data containing cookies and localStorage
   * @returns {Promise<Object>} Object containing script, compressed, and size
   * @throws {Error} If authData is empty or invalid
   */
  async generateScript(authData) {
    // Validate authData is not empty
    if (!authData || typeof authData !== 'object') {
      throw new Error('Invalid authentication data: must be an object');
    }

    const hasCookies = authData.cookies && Array.isArray(authData.cookies) && authData.cookies.length > 0;
    const hasLocalStorage = authData.localStorage && Array.isArray(authData.localStorage) && authData.localStorage.length > 0;

    if (!hasCookies && !hasLocalStorage) {
      throw new Error('Cannot generate script: authentication data is empty');
    }

    // Generate the script using Script Generator
    const script = this.scriptGenerator.generate(authData);
    console.log('Generated script (uncompressed)');

    // Compress the script using Compressor
    const compressed = this.compressor.compress(script);
    console.log('Compressed script');

    // Calculate size information
    const size = this.compressor.getSize(compressed);
    const originalSize = this.compressor.getSize(script);
    
    console.log(`Script size: ${size} bytes (compressed), ${originalSize} bytes (original)`);

    return {
      script,           // Original uncompressed script
      compressed,       // Compressed script
      size,            // Compressed size in bytes
      originalSize     // Original size in bytes
    };
  }

  /**
   * Validate that the URL uses HTTP or HTTPS protocol
   * @param {string} url - The URL to validate
   * @returns {boolean} True if protocol is valid
   */
  isValidProtocol(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  /**
   * Save profile to storage
   * @param {string} profileName - User-provided profile name
   * @param {Object} authData - Authentication data (cookies and localStorage)
   * @param {string} domain - Website domain
   * @returns {Promise<Object>} Saved profile with generated ID
   * @throws {Error} If storage limit is reached or validation fails
   */
  async saveProfile(profileName, authData, domain) {
    // Validate inputs
    if (!profileName || typeof profileName !== 'string' || profileName.trim() === '') {
      throw new Error('Profile name is required and must be a non-empty string');
    }

    if (!authData || typeof authData !== 'object') {
      throw new Error('Invalid authentication data');
    }

    if (!domain || typeof domain !== 'string') {
      throw new Error('Domain is required');
    }

    // Check storage limit before attempting to save
    const limitReached = await this.profileManager.isStorageLimitReached();
    if (limitReached) {
      throw new Error('Storage limit reached (50 profiles). Please delete old profiles to save new ones.');
    }

    try {
      const profile = {
        name: profileName.trim(),
        domain: domain,
        authData: authData
      };

      const savedProfile = await this.profileManager.saveProfile(profile);
      console.log('Profile saved:', savedProfile.id);
      
      return savedProfile;
    } catch (error) {
      // Rethrow with user-friendly message if it's a storage error
      if (error.message.includes('Storage limit')) {
        throw new Error('Storage limit reached (50 profiles). Please delete old profiles to save new ones.');
      }
      throw error;
    }
  }

  /**
   * Load profile from storage by ID
   * @param {string} profileId - Profile ID to load
   * @returns {Promise<Object>} Profile object with id, name, domain, timestamp, authData
   * @throws {Error} If profile not found
   */
  async loadProfile(profileId) {
    if (!profileId || typeof profileId !== 'string') {
      throw new Error('Profile ID is required');
    }

    const profile = await this.profileManager.getProfile(profileId);
    
    if (!profile) {
      throw new Error('Profile not found. It may have been deleted.');
    }

    console.log('Profile loaded:', profileId);
    return profile;
  }

  /**
   * Delete profile from storage by ID
   * @param {string} profileId - Profile ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   * @throws {Error} If profile not found
   */
  async deleteProfile(profileId) {
    if (!profileId || typeof profileId !== 'string') {
      throw new Error('Profile ID is required');
    }

    const deleted = await this.profileManager.deleteProfile(profileId);
    
    if (!deleted) {
      throw new Error('Profile not found. It may have already been deleted.');
    }

    console.log('Profile deleted:', profileId);
    return deleted;
  }

  /**
   * Get all saved profiles
   * @returns {Promise<Array>} Array of profile objects
   */
  async getAllProfiles() {
    const profiles = await this.profileManager.getAllProfiles();
    console.log(`Retrieved ${profiles.length} profiles`);
    return profiles;
  }
}

// Initialize background service
new BackgroundService();
