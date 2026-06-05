/**
 * Profile Manager
 * Manages authentication profile storage using chrome.storage.local
 */

class ProfileManager {
  constructor() {
    this.storageKey = 'autologin_profiles';
    this.maxProfiles = 50;
  }

  /**
   * Save a new profile
   * @param {Object} profile - Profile object with name, domain, timestamp, authData
   * @returns {Promise<Object>} Saved profile with generated ID
   */
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
    await chrome.storage.local.set({ [this.storageKey]: profiles });
    
    return newProfile;
  }

  /**
   * Get all profiles
   * @returns {Promise<Array>} Array of all profiles
   */
  async getAllProfiles() {
    const result = await chrome.storage.local.get([this.storageKey]);
    return result[this.storageKey] || [];
  }

  /**
   * Get profile by ID
   * @param {string} profileId - Profile ID to retrieve
   * @returns {Promise<Object|null>} Profile object or null if not found
   */
  async getProfile(profileId) {
    const profiles = await this.getAllProfiles();
    return profiles.find(p => p.id === profileId) || null;
  }

  /**
   * Delete profile by ID
   * @param {string} profileId - Profile ID to delete
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteProfile(profileId) {
    const profiles = await this.getAllProfiles();
    const filteredProfiles = profiles.filter(p => p.id !== profileId);
    
    if (filteredProfiles.length === profiles.length) {
      return false; // Profile not found
    }

    await chrome.storage.local.set({ [this.storageKey]: filteredProfiles });
    return true;
  }

  /**
   * Check if storage limit reached
   * @returns {Promise<boolean>} True if limit reached
   */
  async isStorageLimitReached() {
    const profiles = await this.getAllProfiles();
    return profiles.length >= this.maxProfiles;
  }

  /**
   * Generate unique profile ID
   * @returns {string} UUID-like profile ID
   */
  generateProfileId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Export for use in background service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProfileManager;
}
