// popup.js - handles saving profile and sending fill message to the active tab

document.addEventListener('DOMContentLoaded', () => {
  const nameEl = document.getElementById('name');
  const emailEl = document.getElementById('email');
  const phoneEl = document.getElementById('phone');
  const shortBioEl = document.getElementById('shortBio');

  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const fillBtn = document.getElementById('fillBtn');
  const statusEl = document.getElementById('status');

  // Load saved profile
  chrome.storage.local.get(['smartAutofillProfile'], (res) => {
    const p = res.smartAutofillProfile || {};
    nameEl.value = p.name || '';
    emailEl.value = p.email || '';
    phoneEl.value = p.phone || '';
    shortBioEl.value = p.shortBio || '';
  });

  // Save profile
  saveBtn.addEventListener('click', () => {
    const profile = {
      name: nameEl.value.trim(),
      email: emailEl.value.trim(),
      phone: phoneEl.value.trim(),
      shortBio: shortBioEl.value.trim()
    };
    chrome.storage.local.set({ smartAutofillProfile: profile }, () => {
      statusEl.textContent = 'Saved ✔';
      setTimeout(() => (statusEl.textContent = ''), 1500);
    });
  });

  // Clear stored profile
  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear saved profile from this browser?')) return;
    chrome.storage.local.remove('smartAutofillProfile', () => {
      nameEl.value = emailEl.value = phoneEl.value = shortBioEl.value = '';
      statusEl.textContent = 'Cleared';
      setTimeout(() => (statusEl.textContent = ''), 1200);
    });
  });

  // Send fill command to active tab
  fillBtn.addEventListener('click', async () => {
    statusEl.textContent = 'Sending fill request...';
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      statusEl.textContent = 'No active tab';
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM' }, (response) => {
      if (chrome.runtime.lastError) {
        // no content script on page or other error
        statusEl.textContent = 'Page not ready (or extension not allowed on this site)';
        return;
      }
      statusEl.textContent = `Done (filled: ${response && response.filled ? response.filled : 0})`;
      setTimeout(() => (statusEl.textContent = ''), 1800);
    });
  });
});
