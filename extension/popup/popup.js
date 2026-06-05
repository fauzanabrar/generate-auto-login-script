/**
 * Popup UI Controller
 * Handles user interactions and communication with background service worker
 */

class PopupUI {
  constructor() {
    // DOM element references
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

    // Current tab information
    this.currentTab = null;

    // Current script data
    this.currentScript = null;
    
    // Captured authentication data
    this.authData = null;

    this.init();
  }

  /**
   * Initialize UI and attach event listeners
   * Requirements: 1.1
   */
  async init() {
    try {
      // Get DOM element references
      this.elements.currentDomain = document.getElementById('current-domain');
      this.elements.captureButton = document.getElementById('capture-button');
      this.elements.errorMessage = document.getElementById('error-message');
      this.elements.errorText = document.getElementById('error-text');
      this.elements.successMessage = document.getElementById('success-message');
      this.elements.successText = document.getElementById('success-text');
      this.elements.dataSummary = document.getElementById('data-summary');
      this.elements.cookieCount = document.getElementById('cookie-count');
      this.elements.localStorageCount = document.getElementById('localstorage-count');
      this.elements.scriptSection = document.getElementById('script-section');
      this.elements.scriptOutput = document.getElementById('script-output');
      this.elements.scriptSize = document.getElementById('script-size');
      this.elements.copyButton         = document.getElementById('copy-button');
      this.elements.downloadJsButton   = document.getElementById('download-js-button');
      this.elements.downloadJsonButton = document.getElementById('download-json-button');
      this.elements.profilesList = document.getElementById('profiles-list');
      this.elements.saveProfileSection = document.getElementById('save-profile-section');
      this.elements.profileNameInput = document.getElementById('profile-name-input');
      this.elements.saveProfileButton = document.getElementById('save-profile-button');
      this.elements.importProfileButton = document.getElementById('import-profile-button');
      this.elements.importFileInput     = document.getElementById('import-file-input');

      // Attach event listeners
      this.attachEventListeners();

      // Display current tab information
      await this.displayTabInfo();

      // Load and display saved profiles
      await this.loadProfiles();

      console.log('Popup UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup UI:', error);
      this.showError('Failed to initialize popup UI');
    }
  }

  /**
   * Attach event listeners to UI elements
   */
  attachEventListeners() {
    // Capture button click handler
    if (this.elements.captureButton) {
      this.elements.captureButton.addEventListener('click', () => {
        this.handleCapture();
      });
    }

    // Copy button click handler
    if (this.elements.copyButton) {
      this.elements.copyButton.addEventListener('click', () => {
        this.copyToClipboard();
      });
    }

    // Download .js button click handler
    if (this.elements.downloadJsButton) {
      this.elements.downloadJsButton.addEventListener('click', () => {
        if (this.currentScript && this.currentTab) {
          const domain = new URL(this.currentTab.url).hostname;
          this.downloadScript(this.currentScript, domain);
        }
      });
    }

    // Download .json button click handler (importable profile)
    if (this.elements.downloadJsonButton) {
      this.elements.downloadJsonButton.addEventListener('click', () => {
        if (this.authData && this.currentTab) {
          const domain = new URL(this.currentTab.url).hostname;
          this.downloadProfileJson(this.authData, domain);
        }
      });
    }

    // Save profile button click handler
    if (this.elements.saveProfileButton) {
      this.elements.saveProfileButton.addEventListener('click', () => {
        this.handleSaveProfile();
      });
    }

    // Enter key handler for profile name input
    if (this.elements.profileNameInput) {
      this.elements.profileNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSaveProfile();
        }
      });
    }

    // Import profile button — triggers hidden file input
    if (this.elements.importProfileButton) {
      this.elements.importProfileButton.addEventListener('click', () => {
        this.elements.importFileInput.value = ''; // reset so same file can be re-imported
        this.elements.importFileInput.click();
      });
    }

    // File input change — read and import selected JSON file
    if (this.elements.importFileInput) {
      this.elements.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.handleImportProfile(file);
      });
    }

    // Close buttons for messages
    const messageCloseButtons = document.querySelectorAll('.message-close');
    messageCloseButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const message = e.target.closest('.message');
        if (message) {
          message.classList.add('hidden');
        }
      });
    });
  }

  /**
   * Display current tab information and validate protocol
   * Requirements: 6.5, 7.1
   */
  async displayTabInfo() {
    try {
      // Query for the active tab in the current window
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        this.showError('No active tab found');
        this.disableCaptureButton();
        return;
      }

      this.currentTab = tab;

      // Extract domain from URL
      const url = new URL(tab.url);
      const domain = url.hostname;

      // Validate protocol (HTTP/HTTPS only)
      if (!this.isValidProtocol(url.protocol)) {
        this.elements.currentDomain.textContent = domain;
        this.showError('Cannot capture data from this protocol. Please use on HTTP or HTTPS websites.');
        this.disableCaptureButton();
        return;
      }

      // Display domain
      this.elements.currentDomain.textContent = domain;
      this.enableCaptureButton();

    } catch (error) {
      console.error('Failed to get tab information:', error);
      this.elements.currentDomain.textContent = 'Error loading tab info';
      this.showError('Failed to access current tab');
      this.disableCaptureButton();
    }
  }

  /**
   * Validate if the protocol is supported (HTTP or HTTPS only)
   * Requirements: 7.1
   * @param {string} protocol - The URL protocol (e.g., 'http:', 'https:', 'chrome:')
   * @returns {boolean} True if protocol is valid (http: or https:)
   */
  isValidProtocol(protocol) {
    return protocol === 'http:' || protocol === 'https:';
  }

  /**
   * Handle capture button click
   * Requirements: 1.2, 1.3, 1.6
   */
  async handleCapture() {
    console.log('Capture button clicked');
    
    try {
      // Hide any previous messages
      if (this.elements.errorMessage) {
        this.elements.errorMessage.classList.add('hidden');
      }
      if (this.elements.successMessage) {
        this.elements.successMessage.classList.add('hidden');
      }
      
      // Validate we have a current tab
      if (!this.currentTab) {
        this.showError('No active tab available');
        return;
      }
      
      // Disable capture button during operation
      this.disableCaptureButton();
      this.elements.captureButton.textContent = 'Capturing...';
      
      // Send message to background service to capture authentication data
      const response = await chrome.runtime.sendMessage({
        action: 'captureAuth',
        tabId: this.currentTab.id,
        url: this.currentTab.url
      });
      
      // Check if capture was successful
      if (!response.success) {
        throw new Error(response.error || 'Failed to capture authentication data');
      }
      
      // Store captured auth data
      this.authData = response.authData;
      
      // Display data summary
      this.displayAuthDataSummary(this.authData);
      
      // Show warnings if any data source failed but we still got some data
      if (this.authData.warnings && this.authData.warnings.length > 0) {
        console.warn('Capture warnings:', this.authData.warnings);
        this.showSuccess(`Data captured with warnings: ${this.authData.warnings.join(', ')}`);
      } else {
        this.showSuccess('Authentication data captured successfully!');
      }
      
      // Generate script after successful capture
      await this.generateAndDisplayScript();
      
      // Show save profile section
      if (this.elements.saveProfileSection) {
        this.elements.saveProfileSection.classList.remove('hidden');
      }
      
    } catch (error) {
      console.error('Capture failed:', error);
      this.showError(error.message || 'Failed to capture authentication data');
    } finally {
      // Re-enable capture button
      this.enableCaptureButton();
      this.elements.captureButton.textContent = 'Capture Auth Data';
    }
  }

  /**
   * Display captured authentication data summary
   * Requirements: 1.2, 1.3, 1.6
   * @param {Object} authData - Authentication data containing cookies and localStorage
   */
  displayAuthDataSummary(authData) {
    if (!authData) {
      console.error('No auth data to display');
      return;
    }

    // Get counts
    const cookieCount = (authData.cookies && Array.isArray(authData.cookies)) 
      ? authData.cookies.length 
      : 0;
    const localStorageCount = (authData.localStorage && Array.isArray(authData.localStorage)) 
      ? authData.localStorage.length 
      : 0;

    // Update UI elements
    if (this.elements.cookieCount) {
      this.elements.cookieCount.textContent = cookieCount.toString();
    }
    if (this.elements.localStorageCount) {
      this.elements.localStorageCount.textContent = localStorageCount.toString();
    }

    // Show data summary section
    if (this.elements.dataSummary) {
      this.elements.dataSummary.classList.remove('hidden');
    }

    console.log(`Displayed summary: ${cookieCount} cookies, ${localStorageCount} localStorage items`);
  }

  /**
   * Generate script from captured auth data and display it
   * Requirements: 1.2, 1.3, 1.6
   */
  async generateAndDisplayScript() {
    if (!this.authData) {
      console.error('No auth data available for script generation');
      return;
    }

    try {
      // Send message to background service to generate script
      const response = await chrome.runtime.sendMessage({
        action: 'generateScript',
        authData: this.authData
      });

      // Check if generation was successful
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate script');
      }

      // Store the compressed script
      this.currentScript = response.compressed;

      // Display the script in textarea
      if (this.elements.scriptOutput) {
        this.elements.scriptOutput.value = response.compressed;
      }

      // Display script size
      if (this.elements.scriptSize) {
        this.elements.scriptSize.textContent = `${response.size} bytes`;
      }

      // Show script section
      if (this.elements.scriptSection) {
        this.elements.scriptSection.classList.remove('hidden');
      }

      console.log('Script generated and displayed successfully');

    } catch (error) {
      console.error('Script generation failed:', error);
      this.showError(error.message || 'Failed to generate script');
    }
  }

  /**
   * Disable capture button
   */
  disableCaptureButton() {
    if (this.elements.captureButton) {
      this.elements.captureButton.disabled = true;
      this.elements.captureButton.style.opacity = '0.5';
      this.elements.captureButton.style.cursor = 'not-allowed';
    }
  }

  /**
   * Enable capture button
   */
  enableCaptureButton() {
    if (this.elements.captureButton) {
      this.elements.captureButton.disabled = false;
      this.elements.captureButton.style.opacity = '1';
      this.elements.captureButton.style.cursor = 'pointer';
    }
  }

  /**
   * Show error message
   * Requirements: 7.5
   * @param {string} message - Error message to display
   */
  showError(message) {
    if (this.elements.errorText && this.elements.errorMessage) {
      this.elements.errorText.textContent = message;
      this.elements.errorMessage.classList.remove('hidden');
      
      // Hide success message if visible
      if (this.elements.successMessage) {
        this.elements.successMessage.classList.add('hidden');
      }
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    if (this.elements.successText && this.elements.successMessage) {
      this.elements.successText.textContent = message;
      this.elements.successMessage.classList.remove('hidden');
      
      // Hide error message if visible
      if (this.elements.errorMessage) {
        this.elements.errorMessage.classList.add('hidden');
      }
    }
  }

  /**
   * Display compressed script in textarea
   * Requirements: 4.1, 4.2
   * @param {string} script - The compressed JavaScript script
   * @param {number} size - The size of the script in bytes
   */
  displayScript(script, size) {
    // Store the current script for later use (copy/download)
    this.currentScript = script;

    // Display the script in the textarea
    if (this.elements.scriptOutput) {
      this.elements.scriptOutput.value = script;
    }

    // Display the script size
    if (this.elements.scriptSize) {
      this.elements.scriptSize.textContent = `${size} bytes`;
    }

    // Show the script section
    if (this.elements.scriptSection) {
      this.elements.scriptSection.classList.remove('hidden');
    }
  }

  /**
   * Copy script to clipboard
   * Requirements: 4.3, 4.4
   */
  async copyToClipboard() {
    if (!this.currentScript) {
      this.showError('No script to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(this.currentScript);
      this.showSuccess('Script copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showError('Failed to copy script to clipboard');
    }
  }

  /**
   * Download script as a .js file
   * Requirements: 4.5, 4.6
   * @param {string} script - The JavaScript script to download
   * @param {string} domain - The domain name for the filename
   */
  downloadScript(script, domain) {
    if (!script) {
      this.showError('No script to download');
      return;
    }

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

  /**
   * Download current authData as an importable .json profile file
   * @param {Object} authData - The captured authentication data
   * @param {string} domain - The domain name for the filename
   */
  downloadProfileJson(authData, domain) {
    if (!authData) {
      this.showError('No authentication data to download');
      return;
    }

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

  /**
   * Load and display saved profiles
   * Requirements: 8.3
   */
  async loadProfiles() {
    try {
      // Request all profiles from background service
      const response = await chrome.runtime.sendMessage({
        action: 'getAllProfiles'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to load profiles');
      }

      const profiles = response.profiles || [];

      // Display profiles in the list
      this.displayProfiles(profiles);

    } catch (error) {
      console.error('Failed to load profiles:', error);
      // Don't show error to user - just log it
      // The empty state will be shown by displayProfiles
    }
  }

  /**
   * Display profiles in the list
   * Requirements: 8.3
   * @param {Array} profiles - Array of profile objects
   */
  displayProfiles(profiles) {
    if (!this.elements.profilesList) {
      console.error('Profiles list element not found');
      return;
    }

    // Clear existing content
    this.elements.profilesList.innerHTML = '';

    // If no profiles, show empty state
    if (!profiles || profiles.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No saved profiles yet';
      this.elements.profilesList.appendChild(emptyState);
      return;
    }

    // Sort profiles by timestamp (newest first)
    const sortedProfiles = profiles.sort((a, b) => b.timestamp - a.timestamp);

    // Create profile items
    sortedProfiles.forEach(profile => {
      const profileItem = this.createProfileItem(profile);
      this.elements.profilesList.appendChild(profileItem);
    });

    console.log(`Displayed ${profiles.length} profiles`);
  }

  /**
   * Create a profile item element
   * Requirements: 8.3
   * @param {Object} profile - Profile object with id, name, domain, timestamp
   * @returns {HTMLElement} Profile item element
   */
  createProfileItem(profile) {
    const item = document.createElement('div');
    item.className = 'profile-item';
    item.dataset.profileId = profile.id;

    // Profile info section (clickable to load)
    const infoSection = document.createElement('div');
    infoSection.className = 'profile-info';
    infoSection.style.cursor = 'pointer';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'profile-name';
    nameDiv.textContent = profile.name;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'profile-meta';
    
    // Format timestamp
    const date = new Date(profile.timestamp);
    const formattedDate = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    metaDiv.textContent = `${profile.domain} • ${formattedDate}`;

    infoSection.appendChild(nameDiv);
    infoSection.appendChild(metaDiv);

    // Add click handler to load profile
    infoSection.addEventListener('click', () => {
      this.handleProfileSelect(profile.id);
    });

    // Actions section (delete button)
    const actionsSection = document.createElement('div');
    actionsSection.className = 'profile-actions';

    const exportButton = document.createElement('button');
    exportButton.className = 'btn-export';
    exportButton.textContent = '⬇';
    exportButton.title = 'Export this profile as JSON';

    exportButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleProfileExport(profile.id);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-delete';
    deleteButton.textContent = 'Delete';
    deleteButton.title = 'Delete this profile';

    // Add click handler to delete profile
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering profile select
      this.handleProfileDelete(profile.id);
    });

    actionsSection.appendChild(exportButton);
    actionsSection.appendChild(deleteButton);

    // Assemble the item
    item.appendChild(infoSection);
    item.appendChild(actionsSection);

    return item;
  }

  /**
   * Handle profile selection - load profile and regenerate script
   * Requirements: 8.4
   * @param {string} profileId - The ID of the profile to load
   */
  async handleProfileSelect(profileId) {
    console.log('Loading profile:', profileId);

    try {
      // Hide any previous messages
      if (this.elements.errorMessage) {
        this.elements.errorMessage.classList.add('hidden');
      }
      if (this.elements.successMessage) {
        this.elements.successMessage.classList.add('hidden');
      }

      // Request profile from background service
      const response = await chrome.runtime.sendMessage({
        action: 'loadProfile',
        profileId: profileId
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to load profile');
      }

      const profile = response.profile;

      // Store the loaded auth data
      this.authData = profile.authData;

      // Update current domain display (optional - show profile domain)
      if (this.elements.currentDomain) {
        this.elements.currentDomain.textContent = `${profile.domain} (from profile)`;
      }

      // Display data summary
      this.displayAuthDataSummary(this.authData);

      // Generate and display script
      await this.generateAndDisplayScript();

      this.showSuccess(`Profile "${profile.name}" loaded successfully`);

    } catch (error) {
      console.error('Failed to load profile:', error);
      this.showError(error.message || 'Failed to load profile');
    }
  }

  /**
   * Handle profile deletion
   * Requirements: 8.5
   * @param {string} profileId - The ID of the profile to delete
   */
  async handleProfileDelete(profileId) {
    console.log('Deleting profile:', profileId);

    // Confirm deletion
    const confirmDelete = confirm('Are you sure you want to delete this profile? This action cannot be undone.');
    if (!confirmDelete) {
      return;
    }

    try {
      // Request profile deletion from background service
      const response = await chrome.runtime.sendMessage({
        action: 'deleteProfile',
        profileId: profileId
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete profile');
      }

      // Reload profiles list to reflect changes
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
      const response = await chrome.runtime.sendMessage({
        action: 'loadProfile',
        profileId
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to load profile for export');
      }

      const profile = response.profile;

      // Build export object — strip internal id so re-import generates a fresh one
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

      // Validate required fields
      if (!data.authData || typeof data.authData !== 'object') {
        throw new Error('Invalid profile file: missing authData');
      }
      const hasCookies = Array.isArray(data.authData.cookies) && data.authData.cookies.length > 0;
      const hasLS = Array.isArray(data.authData.localStorage) && data.authData.localStorage.length > 0;
      if (!hasCookies && !hasLS) {
        throw new Error('Invalid profile file: authData contains no cookies or localStorage items');
      }

      // Use name from file, fall back to filename without extension
      const profileName = (data.name && data.name.trim())
        ? data.name.trim()
        : file.name.replace(/\.json$/i, '');

      const domain = (data.domain && data.domain.trim())
        ? data.domain.trim()
        : 'imported';

      const response = await chrome.runtime.sendMessage({
        action: 'saveProfile',
        profileName,
        authData: data.authData,
        domain
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to save imported profile');
      }

      await this.loadProfiles();
      this.showSuccess(`Profile "${profileName}" imported successfully`);
    } catch (error) {
      console.error('Failed to import profile:', error);
      this.showError(error.message || 'Failed to import profile');
    }
  }

  /**
   * Handle save profile button click
   * Requirements: 8.1, 8.2
   */
  async handleSaveProfile() {
    console.log('Save profile button clicked');

    try {
      // Validate that we have auth data to save
      if (!this.authData) {
        this.showError('No authentication data to save. Please capture data first.');
        return;
      }

      // Get profile name from input
      const profileName = this.elements.profileNameInput ? this.elements.profileNameInput.value.trim() : '';

      if (!profileName) {
        this.showError('Please enter a profile name');
        // Focus the input field
        if (this.elements.profileNameInput) {
          this.elements.profileNameInput.focus();
        }
        return;
      }

      // Get domain from current tab
      if (!this.currentTab) {
        this.showError('No active tab available');
        return;
      }

      const url = new URL(this.currentTab.url);
      const domain = url.hostname;

      // Request profile save from background service
      const response = await chrome.runtime.sendMessage({
        action: 'saveProfile',
        profileName: profileName,
        authData: this.authData,
        domain: domain
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to save profile');
      }

      // Clear the input field
      if (this.elements.profileNameInput) {
        this.elements.profileNameInput.value = '';
      }

      // Reload profiles list to show the new profile
      await this.loadProfiles();

      this.showSuccess(`Profile "${profileName}" saved successfully`);

    } catch (error) {
      console.error('Failed to save profile:', error);
      this.showError(error.message || 'Failed to save profile');
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupUI();
});
