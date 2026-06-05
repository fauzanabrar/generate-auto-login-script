/**
 * Content Script
 * Injected into active tab to access localStorage from the tab's context
 */

/**
 * Extract all localStorage items from the current page
 * @returns {Array<{name: string, value: string}>} Array of localStorage items
 */
function extractLocalStorage() {
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

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getLocalStorage') {
    const data = extractLocalStorage();
    sendResponse({ localStorage: data });
  }
  return true; // Keep channel open for async response
});
