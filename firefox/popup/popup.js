/**
 * Popup UI Controller (Firefox)
 * Same logic as Chrome version; uses browser.* namespace instead of chrome.*
 */

class PopupUI {
  constructor() {
    this.elements = {
      currentDomain: null,
      captureButton: null,
      errorMessage: null,
      errorText: null,
      successMessage: null,
      successText: null,
      dataSummary: null,
      cookieCount: null,
      localStorageCount: null,
      scriptSection: null,
      scriptOutput: null,
      scriptSize: null,
      copyButton: null,
      downloadJsButton: null,
      downloadJsonButton: null,
      profilesList: null,
      saveProfileSection: null,
      profileNameInput: null,
      saveProfileButton: null,
      importProfileButton: null,
      importFileInput: null,
    };

    this.currentTab = null;
    this.currentScript = null;
    this.authData = null;

    this.init();
  }

  async init() {
    try {
      this.elements.currentDomain     = document.getElementById('current-domain');
      this.elements.captureButton     = document.getElementById('capture-button');
      this.elements.errorMessage      = document.getElementById('error-message');
      this.elements.errorText         = document.getElementById('error-text');
      this.elements.successMessage    = document.getElementById('success-message');
      this.elements.successText       = document.getElementById('success-text');
      this.elements.dataSummary       = document.getElementById('data-summary');
      this.elements.cookieCount       = document.getElementById('cookie-count');
      this.elements.localStorageCount = document.getElementById('localstorage-count');
      this.elements.scriptSection     = document.getElementById('script-section');
      this.elements.scriptOutput      = document.getElementById('script-output');
      this.elements.scriptSize        = document.getElementById('script-size');
      this.elements.copyButton        = document.getElementById('copy-button');
      this.elements.downloadJsButton   = document.getElementById('download-js-button');
      this.elements.downloadJsonButton = document.getElementById('download-json-button');
      this.elements.downloadButton    = document.getElementById('download-button');
      this.elements.profilesList      = document.getElementById('profiles-list');
      this.elements.saveProfileSection = document.getElementById('save-profile-section');
      this.elements.profileNameInput  = document.getElementById('profile-name-input');
      this.elements.saveProfileButton = document.getElementById('save-profile-button');
      this.elements.importProfileButton = document.getElementById('import-profile-button');
      this.elements.importFileInput     = document.getElementById('import-file-input');

      this.attachEventListeners();
      await this.displayTabInfo();
      await this.loadProfiles();
    } catch (error) {
      console.error('Failed to initialize popup UI:', error);
      this.showError('Failed to initialize popup UI');
    }
  }

  attachEventListeners() {
    this.elements.captureButton?.addEventListener('click', () => this.handleCapture());
    this.elements.copyButton?.addEventListener('click', () => this.copyToClipboard());
    this.elements.downloadJsButton?.addEventListener('click', () => {
      if (this.currentScript && this.currentTab) {
        const domain = new URL(this.currentTab.url).hostname;
        this.downloadScript(this.currentScript, domain);
      }
    });

    this.elements.downloadJsonButton?.addEventListener('click', () => {
      if (this.authData && this.currentTab) {
        const domain = new URL(this.currentTab.url).hostname;
        this.downloadProfileJson(this.authData, domain);
      }
    });
    this.elements.saveProfileButton?.addEventListener('click', () => this.handleSaveProfile());
    this.elements.profileNameInput?.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.handleSaveProfile();
    });

    // Import profile button — triggers hidden file input
    this.elements.importProfileButton?.addEventListener('click', () => {
      this.elements.importFileInput.value = '';
      this.elements.importFileInput.click();
    });

    // File input change — read and import selected JSON file
    this.elements.importFileInput?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) this.handleImportProfile(file);
    });
    document.querySelectorAll('.message-close').forEach(btn => {
      btn.addEventListener('click', e => {
        e.target.closest('.message')?.classList.add('hidden');
      });
    });
  }

  async displayTabInfo() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        this.showError('No active tab found');
        this.disableCaptureButton();
        return;
      }
      this.currentTab = tab;
      const url = new URL(tab.url);
      this.elements.currentDomain.textContent = url.hostname;

      if (!this.isValidProtocol(url.protocol)) {
        this.showError('Cannot capture data from this protocol. Please use on HTTP or HTTPS websites.');
        this.disableCaptureButton();
        return;
      }
      this.enableCaptureButton();
    } catch (error) {
      console.error('Failed to get tab information:', error);
      this.elements.currentDomain.textContent = 'Error loading tab info';
      this.showError('Failed to access current tab');
      this.disableCaptureButton();
    }
  }

  isValidProtocol(protocol) {
    return protocol === 'http:' || protocol === 'https:';
  }

  async handleCapture() {
    try {
      this.elements.errorMessage?.classList.add('hidden');
      this.elements.successMessage?.classList.add('hidden');

      if (!this.currentTab) { this.showError('No active tab available'); return; }

      this.disableCaptureButton();
      this.elements.captureButton.textContent = 'Capturing...';

      const response = await browser.runtime.sendMessage({
        action: 'captureAuth',
        tabId: this.currentTab.id,
        url: this.currentTab.url
      });

      if (!response.success) throw new Error(response.error || 'Failed to capture authentication data');

      this.authData = response.authData;
      this.displayAuthDataSummary(this.authData);

      if (this.authData.warnings?.length > 0) {
        this.showSuccess(`Data captured with warnings: ${this.authData.warnings.join(', ')}`);
      } else {
        this.showSuccess('Authentication data captured successfully!');
      }

      await this.generateAndDisplayScript();
      this.elements.saveProfileSection?.classList.remove('hidden');

    } catch (error) {
      console.error('Capture failed:', error);
      this.showError(error.message || 'Failed to capture authentication data');
    } finally {
      this.enableCaptureButton();
      this.elements.captureButton.textContent = 'Capture Auth Data';
    }
  }

  displayAuthDataSummary(authData) {
    if (!authData) return;
    const cookieCount = Array.isArray(authData.cookies) ? authData.cookies.length : 0;
    const lsCount = Array.isArray(authData.localStorage) ? authData.localStorage.length : 0;
    if (this.elements.cookieCount) this.elements.cookieCount.textContent = cookieCount;
    if (this.elements.localStorageCount) this.elements.localStorageCount.textContent = lsCount;
    this.elements.dataSummary?.classList.remove('hidden');
  }

  async generateAndDisplayScript() {
    if (!this.authData) return;
    try {
      const response = await browser.runtime.sendMessage({
        action: 'generateScript',
        authData: this.authData
      });
      if (!response.success) throw new Error(response.error || 'Failed to generate script');

      this.currentScript = response.compressed;
      if (this.elements.scriptOutput) this.elements.scriptOutput.value = response.compressed;
      if (this.elements.scriptSize) this.elements.scriptSize.textContent = `${response.size} bytes`;
      this.elements.scriptSection?.classList.remove('hidden');
    } catch (error) {
      console.error('Script generation failed:', error);
      this.showError(error.message || 'Failed to generate script');
    }
  }

  disableCaptureButton() {
    if (this.elements.captureButton) {
      this.elements.captureButton.disabled = true;
      this.elements.captureButton.style.opacity = '0.5';
      this.elements.captureButton.style.cursor = 'not-allowed';
    }
  }

  enableCaptureButton() {
    if (this.elements.captureButton) {
      this.elements.captureButton.disabled = false;
      this.elements.captureButton.style.opacity = '1';
      this.elements.captureButton.style.cursor = 'pointer';
    }
  }

  showError(message) {
    if (this.elements.errorText && this.elements.errorMessage) {
      this.elements.errorText.textContent = message;
      this.elements.errorMessage.classList.remove('hidden');
      this.elements.successMessage?.classList.add('hidden');
    }
  }

  showSuccess(message) {
    if (this.elements.successText && this.elements.successMessage) {
      this.elements.successText.textContent = message;
      this.elements.successMessage.classList.remove('hidden');
      this.elements.errorMessage?.classList.add('hidden');
    }
  }

  async copyToClipboard() {
    if (!this.currentScript) { this.showError('No script to copy'); return; }
    try {
      await navigator.clipboard.writeText(this.currentScript);
      this.showSuccess('Script copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showError('Failed to copy script to clipboard');
    }
  }

  downloadScript(script, domain) {
    if (!script) { this.showError('No script to download'); return; }
    try {
      const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `autologin-${sanitizedDomain}-${Date.now()}.js`;
      const blob = new Blob([script], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showSuccess('Script downloaded successfully');
    } catch (error) {
      console.error('Failed to download script:', error);
      this.showError('Failed to download script');
    }
  }

  downloadProfileJson(authData, domain) {
    if (!authData) { this.showError('No authentication data to download'); return; }
    try {
      const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `autologin-${sanitizedDomain}-${Date.now()}.json`;
      const exportData = {
        exportVersion: '1.0',
        name: sanitizedDomain,
        domain: domain,
        timestamp: Date.now(),
        authData: authData
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showSuccess('Profile JSON downloaded — can be imported on any device');
    } catch (error) {
      console.error('Failed to download profile JSON:', error);
      this.showError('Failed to download profile JSON');
    }
  }

  async loadProfiles() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getAllProfiles' });
      if (!response.success) throw new Error(response.error || 'Failed to load profiles');
      this.displayProfiles(response.profiles || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  }

  displayProfiles(profiles) {
    if (!this.elements.profilesList) return;
    this.elements.profilesList.innerHTML = '';

    if (!profiles || profiles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No saved profiles yet';
      this.elements.profilesList.appendChild(empty);
      return;
    }

    profiles
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(profile => this.elements.profilesList.appendChild(this.createProfileItem(profile)));
  }

  createProfileItem(profile) {
    const item = document.createElement('div');
    item.className = 'profile-item';
    item.dataset.profileId = profile.id;

    const infoSection = document.createElement('div');
    infoSection.className = 'profile-info';
    infoSection.style.cursor = 'pointer';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'profile-name';
    nameDiv.textContent = profile.name;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'profile-meta';
    const date = new Date(profile.timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaDiv.textContent = `${profile.domain} • ${date}`;

    infoSection.appendChild(nameDiv);
    infoSection.appendChild(metaDiv);
    infoSection.addEventListener('click', () => this.handleProfileSelect(profile.id));

    const actionsSection = document.createElement('div');
    actionsSection.className = 'profile-actions';

    const exportButton = document.createElement('button');
    exportButton.className = 'btn-export';
    exportButton.textContent = '⬇';
    exportButton.title = 'Export this profile as JSON';
    exportButton.addEventListener('click', e => {
      e.stopPropagation();
      this.handleProfileExport(profile.id);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-delete';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', e => {
      e.stopPropagation();
      this.handleProfileDelete(profile.id);
    });

    actionsSection.appendChild(exportButton);
    actionsSection.appendChild(deleteButton);
    item.appendChild(infoSection);
    item.appendChild(actionsSection);
    return item;
  }

  async handleProfileSelect(profileId) {
    try {
      this.elements.errorMessage?.classList.add('hidden');
      this.elements.successMessage?.classList.add('hidden');

      const response = await browser.runtime.sendMessage({ action: 'loadProfile', profileId });
      if (!response.success) throw new Error(response.error || 'Failed to load profile');

      this.authData = response.profile.authData;
      if (this.elements.currentDomain) {
        this.elements.currentDomain.textContent = `${response.profile.domain} (from profile)`;
      }
      this.displayAuthDataSummary(this.authData);
      await this.generateAndDisplayScript();
      this.showSuccess(`Profile "${response.profile.name}" loaded successfully`);
    } catch (error) {
      console.error('Failed to load profile:', error);
      this.showError(error.message || 'Failed to load profile');
    }
  }

  async handleProfileDelete(profileId) {
    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) return;
    try {
      const response = await browser.runtime.sendMessage({ action: 'deleteProfile', profileId });
      if (!response.success) throw new Error(response.error || 'Failed to delete profile');
      await this.loadProfiles();
      this.showSuccess('Profile deleted successfully');
    } catch (error) {
      console.error('Failed to delete profile:', error);
      this.showError(error.message || 'Failed to delete profile');
    }
  }

  /**
   * Export a profile as a JSON file
   * @param {string} profileId - The ID of the profile to export
   */
  async handleProfileExport(profileId) {
    try {
      const response = await browser.runtime.sendMessage({ action: 'loadProfile', profileId });
      if (!response.success) throw new Error(response.error || 'Failed to load profile for export');

      const profile = response.profile;
      const exportData = {
        exportVersion: '1.0',
        name: profile.name,
        domain: profile.domain,
        timestamp: profile.timestamp,
        authData: profile.authData
      };

      const json = JSON.stringify(exportData, null, 2);
      const sanitizedName = profile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sanitizedDomain = profile.domain.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `autologin-profile-${sanitizedDomain}-${sanitizedName}.json`;

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccess(`Profile "${profile.name}" exported successfully`);
    } catch (error) {
      console.error('Failed to export profile:', error);
      this.showError(error.message || 'Failed to export profile');
    }
  }

  /**
   * Import a profile from a JSON file
   * @param {File} file - The JSON file to import
   */
  async handleImportProfile(file) {
    try {
      const text = await file.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid file: not valid JSON');
      }

      if (!data.authData || typeof data.authData !== 'object') {
        throw new Error('Invalid profile file: missing authData');
      }
      const hasCookies = Array.isArray(data.authData.cookies) && data.authData.cookies.length > 0;
      const hasLS = Array.isArray(data.authData.localStorage) && data.authData.localStorage.length > 0;
      if (!hasCookies && !hasLS) {
        throw new Error('Invalid profile file: authData contains no cookies or localStorage items');
      }

      const profileName = (data.name && data.name.trim())
        ? data.name.trim()
        : file.name.replace(/\.json$/i, '');

      const domain = (data.domain && data.domain.trim())
        ? data.domain.trim()
        : 'imported';

      const response = await browser.runtime.sendMessage({
        action: 'saveProfile',
        profileName,
        authData: data.authData,
        domain
      });

      if (!response.success) throw new Error(response.error || 'Failed to save imported profile');

      await this.loadProfiles();
      this.showSuccess(`Profile "${profileName}" imported successfully`);
    } catch (error) {
      console.error('Failed to import profile:', error);
      this.showError(error.message || 'Failed to import profile');
    }
  }

  async handleSaveProfile() {
    try {
      if (!this.authData) {
        this.showError('No authentication data to save. Please capture data first.');
        return;
      }
      const profileName = this.elements.profileNameInput?.value.trim() || '';
      if (!profileName) {
        this.showError('Please enter a profile name');
        this.elements.profileNameInput?.focus();
        return;
      }
      if (!this.currentTab) { this.showError('No active tab available'); return; }

      const domain = new URL(this.currentTab.url).hostname;
      const response = await browser.runtime.sendMessage({
        action: 'saveProfile',
        profileName,
        authData: this.authData,
        domain
      });

      if (!response.success) throw new Error(response.error || 'Failed to save profile');
      if (this.elements.profileNameInput) this.elements.profileNameInput.value = '';
      await this.loadProfiles();
      this.showSuccess(`Profile "${profileName}" saved successfully`);
    } catch (error) {
      console.error('Failed to save profile:', error);
      this.showError(error.message || 'Failed to save profile');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupUI());
