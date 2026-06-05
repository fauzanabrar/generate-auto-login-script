/**
 * Content Script (Firefox)
 * Injected into active tab to access localStorage from the tab's context.
 * Uses browser.* namespace.
 */

function extractLocalStorage() {
  const items = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        items.push({ name: key, value: localStorage.getItem(key) });
      }
    }
  } catch (error) {
    console.error('Error extracting localStorage:', error);
  }
  return items;
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'getLocalStorage') {
    return Promise.resolve({ localStorage: extractLocalStorage() });
  }
});
