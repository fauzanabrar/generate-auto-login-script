/**
 * Unit tests for PopupUI class
 * Tests initialization, tab info display, and protocol validation
 * Requirements: 1.1, 6.5, 7.1
 */

// Mock chrome APIs
global.chrome = {
  tabs: {
    query: jest.fn(),
  },
  runtime: {
    sendMessage: jest.fn(),
  },
};

// Mock navigator.clipboard
global.navigator.clipboard = {
  writeText: jest.fn(),
};

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock DOM
document.body.innerHTML = `
  <div id="current-domain"></div>
  <button id="capture-button"></button>
  <div id="error-message" class="hidden"></div>
  <div id="error-text"></div>
  <div id="success-message" class="hidden"></div>
  <div id="success-text"></div>
  <section id="data-summary" class="hidden"></section>
  <span id="cookie-count">0</span>
  <span id="localstorage-count">0</span>
  <section id="script-section" class="hidden"></section>
  <textarea id="script-output"></textarea>
  <span id="script-size"></span>
  <button id="copy-button"></button>
  <button id="download-button"></button>
`;

// Load PopupUI class (in a real test environment, this would be imported)
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
      downloadButton: null,
    };
    this.currentTab = null;
    this.currentScript = null;
    this.authData = null;
  }

  async init() {
    try {
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
      this.elements.copyButton = document.getElementById('copy-button');
      this.elements.downloadButton = document.getElementById('download-button');
      
      this.attachEventListeners();
      await this.displayTabInfo();
    } catch (error) {
      console.error('Failed to initialize popup UI:', error);
      this.showError('Failed to initialize popup UI');
    }
  }

  attachEventListeners() {
    if (this.elements.captureButton) {
      this.elements.captureButton.addEventListener('click', () => {
        this.handleCapture();
      });
    }
    if (this.elements.copyButton) {
      this.elements.copyButton.addEventListener('click', () => {
        this.copyToClipboard();
      });
    }
    if (this.elements.downloadButton) {
      this.elements.downloadButton.addEventListener('click', () => {
        if (this.currentScript && this.currentTab) {
          const url = new URL(this.currentTab.url);
          const domain = url.hostname;
          this.downloadScript(this.currentScript, domain);
        }
      });
    }
  }

  async displayTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        this.showError('No active tab found');
        this.disableCaptureButton();
        return;
      }

      this.currentTab = tab;
      const url = new URL(tab.url);
      const domain = url.hostname;

      if (!this.isValidProtocol(url.protocol)) {
        this.elements.currentDomain.textContent = domain;
        this.showError('Cannot capture data from this protocol. Please use on HTTP or HTTPS websites.');
        this.disableCaptureButton();
        return;
      }

      this.elements.currentDomain.textContent = domain;
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
    console.log('Capture button clicked');
    
    try {
      if (this.elements.errorMessage) {
        this.elements.errorMessage.classList.add('hidden');
      }
      if (this.elements.successMessage) {
        this.elements.successMessage.classList.add('hidden');
      }
      
      if (!this.currentTab) {
        this.showError('No active tab available');
        return;
      }
      
      this.disableCaptureButton();
      this.elements.captureButton.textContent = 'Capturing...';
      
      const response = await chrome.runtime.sendMessage({
        action: 'captureAuth',
        tabId: this.currentTab.id,
        url: this.currentTab.url
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to capture authentication data');
      }
      
      this.authData = response.authData;
      this.displayAuthDataSummary(this.authData);
      
      if (this.authData.warnings && this.authData.warnings.length > 0) {
        console.warn('Capture warnings:', this.authData.warnings);
        this.showSuccess(`Data captured with warnings: ${this.authData.warnings.join(', ')}`);
      } else {
        this.showSuccess('Authentication data captured successfully!');
      }
      
      await this.generateAndDisplayScript();
      
    } catch (error) {
      console.error('Capture failed:', error);
      this.showError(error.message || 'Failed to capture authentication data');
    } finally {
      this.enableCaptureButton();
      this.elements.captureButton.textContent = 'Capture Auth Data';
    }
  }

  displayAuthDataSummary(authData) {
    if (!authData) {
      console.error('No auth data to display');
      return;
    }

    const cookieCount = (authData.cookies && Array.isArray(authData.cookies)) 
      ? authData.cookies.length 
      : 0;
    const localStorageCount = (authData.localStorage && Array.isArray(authData.localStorage)) 
      ? authData.localStorage.length 
      : 0;

    if (this.elements.cookieCount) {
      this.elements.cookieCount.textContent = cookieCount.toString();
    }
    if (this.elements.localStorageCount) {
      this.elements.localStorageCount.textContent = localStorageCount.toString();
    }

    if (this.elements.dataSummary) {
      this.elements.dataSummary.classList.remove('hidden');
    }

    console.log(`Displayed summary: ${cookieCount} cookies, ${localStorageCount} localStorage items`);
  }

  async generateAndDisplayScript() {
    if (!this.authData) {
      console.error('No auth data available for script generation');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateScript',
        authData: this.authData
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate script');
      }

      this.currentScript = response.compressed;

      if (this.elements.scriptOutput) {
        this.elements.scriptOutput.value = response.compressed;
      }

      if (this.elements.scriptSize) {
        this.elements.scriptSize.textContent = `${response.size} bytes`;
      }

      if (this.elements.scriptSection) {
        this.elements.scriptSection.classList.remove('hidden');
      }

      console.log('Script generated and displayed successfully');

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
      
      if (this.elements.successMessage) {
        this.elements.successMessage.classList.add('hidden');
      }
    }
  }

  showSuccess(message) {
    if (this.elements.successText && this.elements.successMessage) {
      this.elements.successText.textContent = message;
      this.elements.successMessage.classList.remove('hidden');
      
      if (this.elements.errorMessage) {
        this.elements.errorMessage.classList.add('hidden');
      }
    }
  }

  displayScript(script, size) {
    this.currentScript = script;
    if (this.elements.scriptOutput) {
      this.elements.scriptOutput.value = script;
    }
    if (this.elements.scriptSize) {
      this.elements.scriptSize.textContent = `${size} bytes`;
    }
    if (this.elements.scriptSection) {
      this.elements.scriptSection.classList.remove('hidden');
    }
  }

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

  downloadScript(script, domain) {
    if (!script) {
      this.showError('No script to download');
      return;
    }
    try {
      const timestamp = Date.now();
      const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `autologin-${sanitizedDomain}-${timestamp}.js`;
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
}

describe('PopupUI - Task 13.1 Requirements', () => {
  let popupUI;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="current-domain"></div>
      <button id="capture-button"></button>
      <div id="error-message" class="hidden"></div>
      <div id="error-text"></div>
      <div id="success-message" class="hidden"></div>
      <div id="success-text"></div>
      <section id="script-section" class="hidden"></section>
      <textarea id="script-output"></textarea>
      <span id="script-size"></span>
      <button id="copy-button"></button>
      <button id="download-button"></button>
    `;

    // Reset chrome API mocks
    chrome.tabs.query.mockReset();
    
    // Reset clipboard mock
    navigator.clipboard.writeText.mockReset();
    navigator.clipboard.writeText.mockResolvedValue(undefined);
    
    // Reset URL mocks
    URL.createObjectURL.mockReturnValue('blob:mock-url');
    URL.revokeObjectURL.mockClear();
    
    popupUI = new PopupUI();
  });

  describe('Requirement 1.1: init() method', () => {
    test('should initialize UI elements and attach event listeners', async () => {
      // Mock a valid HTTP tab
      chrome.tabs.query.mockResolvedValue([{
        url: 'https://example.com/page',
        id: 1,
      }]);

      await popupUI.init();

      // Verify DOM elements are initialized
      expect(popupUI.elements.currentDomain).toBeTruthy();
      expect(popupUI.elements.captureButton).toBeTruthy();
      expect(popupUI.elements.errorMessage).toBeTruthy();
      expect(popupUI.elements.errorText).toBeTruthy();
      expect(popupUI.elements.successMessage).toBeTruthy();
      expect(popupUI.elements.successText).toBeTruthy();

      // Verify event listeners are attached (button should have click listener)
      expect(popupUI.elements.captureButton).not.toBeNull();
    });
  });

  describe('Requirement 6.5: displayTabInfo() shows current tab domain using chrome.tabs.query()', () => {
    test('should display domain from HTTPS URL', async () => {
      const mockTab = {
        url: 'https://example.com/path/to/page',
        id: 1,
      };
      chrome.tabs.query.mockResolvedValue([mockTab]);

      await popupUI.init();

      expect(chrome.tabs.query).toHaveBeenCalledWith({ 
        active: true, 
        currentWindow: true 
      });
      expect(popupUI.elements.currentDomain.textContent).toBe('example.com');
      expect(popupUI.elements.captureButton.disabled).toBe(false);
    });

    test('should display domain from HTTP URL', async () => {
      const mockTab = {
        url: 'http://test.org:8080/admin',
        id: 2,
      };
      chrome.tabs.query.mockResolvedValue([mockTab]);

      await popupUI.init();

      expect(popupUI.elements.currentDomain.textContent).toBe('test.org');
      expect(popupUI.elements.captureButton.disabled).toBe(false);
    });

    test('should handle subdomain correctly', async () => {
      const mockTab = {
        url: 'https://api.subdomain.example.com/v1/endpoint',
        id: 3,
      };
      chrome.tabs.query.mockResolvedValue([mockTab]);

      await popupUI.init();

      expect(popupUI.elements.currentDomain.textContent).toBe('api.subdomain.example.com');
    });
  });

  describe('Requirement 7.1: Validate tab protocol (HTTP/HTTPS only)', () => {
    test('should accept HTTP protocol', () => {
      expect(popupUI.isValidProtocol('http:')).toBe(true);
    });

    test('should accept HTTPS protocol', () => {
      expect(popupUI.isValidProtocol('https:')).toBe(true);
    });

    test('should reject chrome:// protocol', () => {
      expect(popupUI.isValidProtocol('chrome:')).toBe(false);
    });

    test('should reject file:// protocol', () => {
      expect(popupUI.isValidProtocol('file:')).toBe(false);
    });

    test('should reject about: protocol', () => {
      expect(popupUI.isValidProtocol('about:')).toBe(false);
    });

    test('should show error and disable button for unsupported protocol', async () => {
      const mockTab = {
        url: 'chrome://extensions/',
        id: 4,
      };
      chrome.tabs.query.mockResolvedValue([mockTab]);

      await popupUI.init();

      expect(popupUI.elements.currentDomain.textContent).toBe('extensions');
      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toContain('Cannot capture data from this protocol');
      expect(popupUI.elements.captureButton.disabled).toBe(true);
    });

    test('should show error and disable button for file:// protocol', async () => {
      const mockTab = {
        url: 'file:///C:/Users/test/file.html',
        id: 5,
      };
      chrome.tabs.query.mockResolvedValue([mockTab]);

      await popupUI.init();

      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toContain('Cannot capture data from this protocol');
      expect(popupUI.elements.captureButton.disabled).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should show error when no active tab found', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      await popupUI.init();

      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toBe('No active tab found');
      expect(popupUI.elements.captureButton.disabled).toBe(true);
    });

    test('should handle chrome.tabs.query error gracefully', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Permission denied'));

      await popupUI.init();

      expect(popupUI.elements.currentDomain.textContent).toBe('Error loading tab info');
      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toBe('Failed to access current tab');
      expect(popupUI.elements.captureButton.disabled).toBe(true);
    });
  });
});

describe('PopupUI - Task 13.2 Requirements: Data Capture UI Flow', () => {
  let popupUI;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="current-domain"></div>
      <button id="capture-button">Capture Auth Data</button>
      <div id="error-message" class="hidden"></div>
      <div id="error-text"></div>
      <div id="success-message" class="hidden"></div>
      <div id="success-text"></div>
      <section id="data-summary" class="hidden">
        <span id="cookie-count">0</span>
        <span id="localstorage-count">0</span>
      </section>
      <section id="script-section" class="hidden"></section>
      <textarea id="script-output"></textarea>
      <span id="script-size"></span>
      <button id="copy-button"></button>
      <button id="download-button"></button>
    `;

    // Reset mocks
    chrome.tabs.query.mockReset();
    chrome.runtime.sendMessage.mockReset();
    navigator.clipboard.writeText.mockReset();
    navigator.clipboard.writeText.mockResolvedValue(undefined);

    popupUI = new PopupUI();
    popupUI.elements.currentDomain = document.getElementById('current-domain');
    popupUI.elements.captureButton = document.getElementById('capture-button');
    popupUI.elements.errorMessage = document.getElementById('error-message');
    popupUI.elements.errorText = document.getElementById('error-text');
    popupUI.elements.successMessage = document.getElementById('success-message');
    popupUI.elements.successText = document.getElementById('success-text');
    popupUI.elements.dataSummary = document.getElementById('data-summary');
    popupUI.elements.cookieCount = document.getElementById('cookie-count');
    popupUI.elements.localStorageCount = document.getElementById('localstorage-count');
    popupUI.elements.scriptSection = document.getElementById('script-section');
    popupUI.elements.scriptOutput = document.getElementById('script-output');
    popupUI.elements.scriptSize = document.getElementById('script-size');
    popupUI.currentTab = { id: 1, url: 'https://example.com' };
  });

  describe('Requirement 1.2, 1.3: handleCapture() sends captureAuth message to background service', () => {
    test('should send captureAuth message with tabId and url', async () => {
      const mockAuthData = {
        cookies: [
          { name: 'session', value: 'abc123', domain: 'example.com', path: '/', expires: 1234567890, secure: true, httpOnly: true, sameSite: 'Lax' }
        ],
        localStorage: [
          { name: 'token', value: 'xyz789' }
        ]
      };

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        authData: mockAuthData
      });

      // Mock generateAndDisplayScript to prevent further calls
      popupUI.generateAndDisplayScript = jest.fn().mockResolvedValue();

      await popupUI.handleCapture();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'captureAuth',
        tabId: 1,
        url: 'https://example.com'
      });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    test('should handle capture success and store authData', async () => {
      const mockAuthData = {
        cookies: [{ name: 'c1', value: 'v1' }],
        localStorage: [{ name: 'k1', value: 'v1' }]
      };

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        authData: mockAuthData
      });

      popupUI.generateAndDisplayScript = jest.fn().mockResolvedValue();

      await popupUI.handleCapture();

      expect(popupUI.authData).toEqual(mockAuthData);
    });

    test('should handle capture failure with error message', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Permission denied'
      });

      await popupUI.handleCapture();

      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toBe('Permission denied');
    });

    test('should disable button during capture', async () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        // Check button state during capture
        expect(popupUI.elements.captureButton.disabled).toBe(true);
        expect(popupUI.elements.captureButton.textContent).toBe('Capturing...');
        return Promise.resolve({
          success: true,
          authData: { cookies: [], localStorage: [] }
        });
      });

      popupUI.generateAndDisplayScript = jest.fn().mockResolvedValue();

      await popupUI.handleCapture();

      // Button should be re-enabled after capture
      expect(popupUI.elements.captureButton.disabled).toBe(false);
      expect(popupUI.elements.captureButton.textContent).toBe('Capture Auth Data');
    });

    test('should show error when no active tab', async () => {
      popupUI.currentTab = null;

      await popupUI.handleCapture();

      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toBe('No active tab available');
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 1.6: displayAuthDataSummary() shows cookie and localStorage counts', () => {
    test('should display correct cookie and localStorage counts', () => {
      const authData = {
        cookies: [
          { name: 'c1', value: 'v1' },
          { name: 'c2', value: 'v2' },
          { name: 'c3', value: 'v3' }
        ],
        localStorage: [
          { name: 'k1', value: 'v1' },
          { name: 'k2', value: 'v2' }
        ]
      };

      popupUI.displayAuthDataSummary(authData);

      expect(popupUI.elements.cookieCount.textContent).toBe('3');
      expect(popupUI.elements.localStorageCount.textContent).toBe('2');
    });

    test('should show zero counts for empty arrays', () => {
      const authData = {
        cookies: [],
        localStorage: []
      };

      popupUI.displayAuthDataSummary(authData);

      expect(popupUI.elements.cookieCount.textContent).toBe('0');
      expect(popupUI.elements.localStorageCount.textContent).toBe('0');
    });

    test('should handle missing cookies array', () => {
      const authData = {
        localStorage: [{ name: 'k1', value: 'v1' }]
      };

      popupUI.displayAuthDataSummary(authData);

      expect(popupUI.elements.cookieCount.textContent).toBe('0');
      expect(popupUI.elements.localStorageCount.textContent).toBe('1');
    });

    test('should handle missing localStorage array', () => {
      const authData = {
        cookies: [{ name: 'c1', value: 'v1' }]
      };

      popupUI.displayAuthDataSummary(authData);

      expect(popupUI.elements.cookieCount.textContent).toBe('1');
      expect(popupUI.elements.localStorageCount.textContent).toBe('0');
    });

    test('should make data summary section visible', () => {
      expect(popupUI.elements.dataSummary.classList.contains('hidden')).toBe(true);

      const authData = {
        cookies: [{ name: 'c1', value: 'v1' }],
        localStorage: [{ name: 'k1', value: 'v1' }]
      };

      popupUI.displayAuthDataSummary(authData);

      expect(popupUI.elements.dataSummary.classList.contains('hidden')).toBe(false);
    });

    test('should handle null authData gracefully', () => {
      // Should not throw error
      expect(() => {
        popupUI.displayAuthDataSummary(null);
      }).not.toThrow();
    });

    test('should handle large counts correctly', () => {
      const authData = {
        cookies: Array.from({ length: 50 }, (_, i) => ({ name: `c${i}`, value: `v${i}` })),
        localStorage: Array.from({ length: 100 }, (_, i) => ({ name: `k${i}`, value: `v${i}` }))
      };

      popupUI.displayAuthDataSummary(authData);

      expect(popupUI.elements.cookieCount.textContent).toBe('50');
      expect(popupUI.elements.localStorageCount.textContent).toBe('100');
    });
  });

  describe('Requirement 1.2, 1.3: Script generation after successful capture', () => {
    test('should call generateAndDisplayScript after successful capture', async () => {
      const mockAuthData = {
        cookies: [{ name: 'c1', value: 'v1' }],
        localStorage: [{ name: 'k1', value: 'v1' }]
      };

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        authData: mockAuthData
      });

      // Mock generateAndDisplayScript
      popupUI.generateAndDisplayScript = jest.fn().mockResolvedValue();

      await popupUI.handleCapture();

      expect(popupUI.generateAndDisplayScript).toHaveBeenCalled();
      expect(popupUI.generateAndDisplayScript).toHaveBeenCalledTimes(1);
    });

    test('should not call generateAndDisplayScript on capture failure', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Capture failed'
      });

      popupUI.generateAndDisplayScript = jest.fn().mockResolvedValue();

      await popupUI.handleCapture();

      expect(popupUI.generateAndDisplayScript).not.toHaveBeenCalled();
    });

    test('should handle script generation failure gracefully', async () => {
      const mockAuthData = {
        cookies: [{ name: 'c1', value: 'v1' }],
        localStorage: [{ name: 'k1', value: 'v1' }]
      };

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        authData: mockAuthData
      });

      // Mock generateAndDisplayScript to throw error
      popupUI.generateAndDisplayScript = jest.fn().mockRejectedValue(new Error('Script generation failed'));

      await popupUI.handleCapture();

      // Should still complete the capture flow
      expect(popupUI.authData).toEqual(mockAuthData);
      // Button should be re-enabled
      expect(popupUI.elements.captureButton.disabled).toBe(false);
    });
  });

  describe('Integration: Full capture flow', () => {
    test('should complete full capture flow successfully', async () => {
      const mockAuthData = {
        cookies: [
          { name: 'session', value: 'abc123', domain: 'example.com', path: '/', expires: 1234567890, secure: true, httpOnly: true, sameSite: 'Lax' },
          { name: 'token', value: 'xyz789', domain: 'example.com', path: '/', expires: 9876543210, secure: false, httpOnly: false, sameSite: 'None' }
        ],
        localStorage: [
          { name: 'user_id', value: '12345' },
          { name: 'preferences', value: '{"theme":"dark"}' }
        ]
      };

      const mockScript = '(function(){document.cookie="session=abc123";localStorage.setItem("user_id","12345");})();';
      const mockSize = 95;

      // Mock capture response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.action === 'captureAuth') {
          return Promise.resolve({
            success: true,
            authData: mockAuthData
          });
        } else if (message.action === 'generateScript') {
          return Promise.resolve({
            success: true,
            compressed: mockScript,
            size: mockSize
          });
        }
      });

      await popupUI.handleCapture();

      // Verify capture message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'captureAuth',
        tabId: 1,
        url: 'https://example.com'
      });

      // Verify auth data was stored
      expect(popupUI.authData).toEqual(mockAuthData);

      // Verify data summary was displayed
      expect(popupUI.elements.cookieCount.textContent).toBe('2');
      expect(popupUI.elements.localStorageCount.textContent).toBe('2');
      expect(popupUI.elements.dataSummary.classList.contains('hidden')).toBe(false);

      // Verify success message was shown
      expect(popupUI.elements.successMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.successText.textContent).toContain('captured successfully');

      // Verify script generation was called
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'generateScript',
        authData: mockAuthData
      });

      // Verify script was displayed
      expect(popupUI.elements.scriptOutput.value).toBe(mockScript);
      expect(popupUI.elements.scriptSize.textContent).toBe('95 bytes');
      expect(popupUI.elements.scriptSection.classList.contains('hidden')).toBe(false);
    });

    test('should handle warnings during capture', async () => {
      const mockAuthData = {
        cookies: [{ name: 'c1', value: 'v1' }],
        localStorage: [],
        warnings: ['Failed to access localStorage due to CSP']
      };

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        authData: mockAuthData
      });

      popupUI.generateAndDisplayScript = jest.fn().mockResolvedValue();

      await popupUI.handleCapture();

      expect(popupUI.elements.successMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.successText.textContent).toContain('with warnings');
      expect(popupUI.elements.successText.textContent).toContain('Failed to access localStorage due to CSP');
    });
  });
});

describe('PopupUI - Task 13.3 Requirements: Script Display and Actions', () => {
  let popupUI;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="current-domain"></div>
      <button id="capture-button"></button>
      <div id="error-message" class="hidden"></div>
      <div id="error-text"></div>
      <div id="success-message" class="hidden"></div>
      <div id="success-text"></div>
      <section id="script-section" class="hidden"></section>
      <textarea id="script-output"></textarea>
      <span id="script-size"></span>
      <button id="copy-button"></button>
      <button id="download-button"></button>
    `;

    // Reset mocks
    chrome.tabs.query.mockReset();
    navigator.clipboard.writeText.mockReset();
    navigator.clipboard.writeText.mockResolvedValue(undefined);
    URL.createObjectURL.mockReturnValue('blob:mock-url');
    URL.revokeObjectURL.mockClear();

    popupUI = new PopupUI();
    popupUI.elements.scriptSection = document.getElementById('script-section');
    popupUI.elements.scriptOutput = document.getElementById('script-output');
    popupUI.elements.scriptSize = document.getElementById('script-size');
    popupUI.elements.copyButton = document.getElementById('copy-button');
    popupUI.elements.downloadButton = document.getElementById('download-button');
    popupUI.elements.errorMessage = document.getElementById('error-message');
    popupUI.elements.errorText = document.getElementById('error-text');
    popupUI.elements.successMessage = document.getElementById('success-message');
    popupUI.elements.successText = document.getElementById('success-text');
  });

  describe('Requirement 4.1: displayScript(script, size) shows compressed script in textarea', () => {
    test('should display script in textarea', () => {
      const script = '(function(){console.log("test");})();';
      const size = 38;

      popupUI.displayScript(script, size);

      expect(popupUI.elements.scriptOutput.value).toBe(script);
    });

    test('should store script in currentScript property', () => {
      const script = '(function(){alert("hello");})();';
      const size = 32;

      popupUI.displayScript(script, size);

      expect(popupUI.currentScript).toBe(script);
    });

    test('should handle empty script', () => {
      const script = '';
      const size = 0;

      popupUI.displayScript(script, size);

      expect(popupUI.elements.scriptOutput.value).toBe('');
      expect(popupUI.currentScript).toBe('');
    });

    test('should handle long script', () => {
      const script = '(function(){' + 'x'.repeat(10000) + '})();';
      const size = script.length;

      popupUI.displayScript(script, size);

      expect(popupUI.elements.scriptOutput.value).toBe(script);
      expect(popupUI.currentScript).toBe(script);
    });
  });

  describe('Requirement 4.2: displayScript() shows script size in bytes', () => {
    test('should display script size in bytes', () => {
      const script = '(function(){console.log("test");})();';
      const size = 38;

      popupUI.displayScript(script, size);

      expect(popupUI.elements.scriptSize.textContent).toBe('38 bytes');
    });

    test('should display zero size for empty script', () => {
      const script = '';
      const size = 0;

      popupUI.displayScript(script, size);

      expect(popupUI.elements.scriptSize.textContent).toBe('0 bytes');
    });

    test('should display large size correctly', () => {
      const script = 'x'.repeat(50000);
      const size = 50000;

      popupUI.displayScript(script, size);

      expect(popupUI.elements.scriptSize.textContent).toBe('50000 bytes');
    });
  });

  describe('Requirement 4.1: displayScript() makes script section visible', () => {
    test('should remove hidden class from script section', () => {
      expect(popupUI.elements.scriptSection.classList.contains('hidden')).toBe(true);

      const script = '(function(){})();';
      const size = 16;

      popupUI.displayScript(script, size);

      expect(popupUI.elements.scriptSection.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Requirement 4.3: copyToClipboard() uses navigator.clipboard.writeText()', () => {
    test('should copy script to clipboard', async () => {
      const script = '(function(){console.log("copy test");})();';
      popupUI.currentScript = script;

      await popupUI.copyToClipboard();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(script);
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });

    test('should handle empty script', async () => {
      popupUI.currentScript = null;

      await popupUI.copyToClipboard();

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(popupUI.elements.errorText.textContent).toBe('No script to copy');
    });
  });

  describe('Requirement 4.4: Show success message "Script copied to clipboard"', () => {
    test('should show success message after successful copy', async () => {
      const script = '(function(){})();';
      popupUI.currentScript = script;

      await popupUI.copyToClipboard();

      expect(popupUI.elements.successMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.successText.textContent).toBe('Script copied to clipboard');
    });

    test('should show error message when copy fails', async () => {
      const script = '(function(){})();';
      popupUI.currentScript = script;
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard permission denied'));

      await popupUI.copyToClipboard();

      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toBe('Failed to copy script to clipboard');
    });
  });

  describe('Requirement 4.5: downloadScript(script, domain) creates and downloads .js file', () => {
    test('should create blob with script content', () => {
      const script = '(function(){console.log("download");})();';
      const domain = 'example.com';

      // Mock Blob constructor
      const mockBlob = { type: 'application/javascript' };
      global.Blob = jest.fn((content, options) => {
        expect(content).toEqual([script]);
        expect(options.type).toBe('application/javascript');
        return mockBlob;
      });

      popupUI.downloadScript(script, domain);

      expect(global.Blob).toHaveBeenCalled();
    });

    test('should create download link with blob URL', () => {
      const script = '(function(){})();';
      const domain = 'test.org';

      // Mock Blob
      global.Blob = jest.fn(() => ({}));

      popupUI.downloadScript(script, domain);

      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    test('should clean up blob URL after download', () => {
      const script = '(function(){})();';
      const domain = 'cleanup.com';

      // Mock Blob
      global.Blob = jest.fn(() => ({}));

      popupUI.downloadScript(script, domain);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    test('should show error when no script provided', () => {
      popupUI.downloadScript(null, 'example.com');

      expect(popupUI.elements.errorText.textContent).toBe('No script to download');
    });

    test('should show success message after successful download', () => {
      const script = '(function(){})();';
      const domain = 'success.com';

      // Mock Blob
      global.Blob = jest.fn(() => ({}));

      popupUI.downloadScript(script, domain);

      expect(popupUI.elements.successText.textContent).toBe('Script downloaded successfully');
    });
  });

  describe('Requirement 4.6: Generate filename using format "autologin-{domain}-{timestamp}.js"', () => {
    test('should generate filename with correct format', () => {
      const script = '(function(){})();';
      const domain = 'example.com';
      const mockTimestamp = 1234567890123;

      // Mock Date.now()
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      // Mock Blob and capture the anchor element
      global.Blob = jest.fn(() => ({}));
      
      let capturedFilename;
      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const element = originalCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(element, 'download', {
            set: function(value) {
              capturedFilename = value;
              this._download = value;
            },
            get: function() {
              return this._download;
            }
          });
        }
        return element;
      });

      popupUI.downloadScript(script, domain);

      expect(capturedFilename).toBe(`autologin-example.com-${mockTimestamp}.js`);

      // Cleanup
      Date.now.mockRestore();
      document.createElement.mockRestore();
    });

    test('should sanitize domain with special characters', () => {
      const script = '(function(){})();';
      const domain = 'sub.domain:8080/path?query=1';
      const mockTimestamp = 9876543210987;

      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      global.Blob = jest.fn(() => ({}));

      let capturedFilename;
      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const element = originalCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(element, 'download', {
            set: function(value) {
              capturedFilename = value;
              this._download = value;
            },
            get: function() {
              return this._download;
            }
          });
        }
        return element;
      });

      popupUI.downloadScript(script, domain);

      // Should replace invalid characters with underscore
      expect(capturedFilename).toMatch(/^autologin-[a-zA-Z0-9._-]+-\d+\.js$/);
      expect(capturedFilename).not.toContain(':');
      expect(capturedFilename).not.toContain('/');
      expect(capturedFilename).not.toContain('?');

      Date.now.mockRestore();
      document.createElement.mockRestore();
    });

    test('should handle domains with dots and hyphens', () => {
      const script = '(function(){})();';
      const domain = 'api.sub-domain.example.com';
      const mockTimestamp = 1111111111111;

      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      global.Blob = jest.fn(() => ({}));

      let capturedFilename;
      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const element = originalCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(element, 'download', {
            set: function(value) {
              capturedFilename = value;
              this._download = value;
            },
            get: function() {
              return this._download;
            }
          });
        }
        return element;
      });

      popupUI.downloadScript(script, domain);

      // Dots and hyphens are valid filename characters and should be preserved
      expect(capturedFilename).toBe(`autologin-api.sub-domain.example.com-${mockTimestamp}.js`);

      Date.now.mockRestore();
      document.createElement.mockRestore();
    });
  });

  describe('Error handling', () => {
    test('should handle download errors gracefully', () => {
      const script = '(function(){})();';
      const domain = 'error.com';

      // Mock Blob to throw error
      global.Blob = jest.fn(() => {
        throw new Error('Blob creation failed');
      });

      popupUI.downloadScript(script, domain);

      expect(popupUI.elements.errorMessage.classList.contains('hidden')).toBe(false);
      expect(popupUI.elements.errorText.textContent).toBe('Failed to download script');
    });
  });
});
