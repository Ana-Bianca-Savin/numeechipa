// Service worker - handles communication between popup and content scripts

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'summon') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'summon' });
      }
    });
  }

  if (msg.type === 'getStats') {
    chrome.storage.local.get(['totalPets'], (data) => {
      sendResponse({ totalPets: data.totalPets || 0 });
    });
    return true; // async response
  }
});
