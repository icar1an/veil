// Veil - Background Service Worker

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      enabled: true,
      mode: 'text',
      font: 'cormorant',
      showChannel: true,
      showDuration: true,
      showNoise: true,
      accentFromHash: false
    });
    console.log('Veil installed with default settings');
  }
});

// Optional: Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender is from our extension (defense in depth)
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(null, (data) => {
      sendResponse(data);
    });
    return true; // Keep channel open for async response
  }
});
