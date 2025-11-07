// content.js — Enhanced Autofill Logic
// This script listens for messages from the popup and fills forms automatically
// on any website using locally stored profile data.

(function () {
  // Utility: trigger events so the website detects input changes
  function triggerEvents(el) {
    ['input', 'change', 'blur'].forEach((evt) => {
      el.dispatchEvent(new Event(evt, { bubbles: true }));
    });
  }

  // Get the visible label text associated with an input if available
  function getLabelText(input) {
    if (!input) return '';
    // For attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label && label.textContent) return label.textContent.trim();
    }
    // Parent label
    const parentLabel = input.closest('label');
    if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();

    // Nearby text
    const prev = input.previousElementSibling;
    if (prev && ['LABEL', 'DIV', 'SPAN', 'P', 'STRONG'].includes(prev.tagName)) {
      return prev.textContent.trim();
    }

    // Placeholder fallback
    return input.placeholder ? input.placeholder.trim() : '';
  }

  // Detect long-answer fields (like "Why do you want this job?")
  function isLongAnswerField(el) {
    if (el.tagName === 'TEXTAREA') return true;
    if (el.rows && el.rows > 3) return true;

    const text = (getLabelText(el) + ' ' + el.placeholder).toLowerCase();
    return /(why|about|experience|motivation|describe|summary|cover|statement|bio)/.test(text);
  }

  // Map input field to appropriate profile data
  function mapValueToElement(el, profile) {
    const attrs = [
      el.name,
      el.id,
      el.placeholder,
      getLabelText(el)
    ].join(' ').toLowerCase();

    const h = attrs.replace(/[^a-z0-9\s]/g, ' ');

    // Short-field matching
    if (/\bemail\b|e[-\s]?mail/.test(h)) return profile.email || '';
    if (/\b(first|full|given).*name|name\b/.test(h)) return profile.name || '';
    if (/\blast.*name/.test(h) && profile.name?.includes(' ')) {
      return profile.name.split(' ').slice(-1).join(' ');
    }
    if (/\bphone\b|mobile|tel|contact/.test(h)) return profile.phone || '';
    if (/\baddress|street|location/.test(h)) return profile.address || '';
    if (/\bcity|town/.test(h)) return profile.city || '';
    if (/\bstate|region|province/.test(h)) return profile.state || '';
    if (/\bzip|postal|pincode/.test(h)) return profile.zip || '';
    if (/\bcompany|organization|organisation|employer/.test(h)) return profile.company || '';
    if (/\brole|position|title|job/.test(h)) return profile.role || '';
    if (/\blinkedin|github|portfolio|website/.test(h)) return profile.links || '';

    // Long-answer fallback
    if (isLongAnswerField(el)) return profile.shortBio || '';

    return null;
  }

  // Main autofill logic
  async function fillWithProfile(profile) {
    const fields = Array.from(document.querySelectorAll('input, textarea, select'));
    let filledCount = 0;

    for (const el of fields) {
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'file', 'password', 'image'].includes(type)) continue;

      const mappedValue = mapValueToElement(el, profile);
      if (mappedValue === null || mappedValue === undefined || mappedValue === '') continue;

      if (el.tagName === 'SELECT') {
        for (const opt of el.options) {
          if (opt.value?.toLowerCase().includes(mappedValue.toLowerCase()) ||
              opt.text?.toLowerCase().includes(mappedValue.toLowerCase())) {
            el.value = opt.value;
            triggerEvents(el);
            filledCount++;
            break;
          }
        }
        continue;
      }

      el.focus();
      el.value = mappedValue;
      triggerEvents(el);
      filledCount++;
    }

    return filledCount;
  }

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'FILL_FORM') {
      chrome.storage.local.get(['smartAutofillProfile'], async (result) => {
        const profile = result.smartAutofillProfile || {};
        const filledCount = await fillWithProfile(profile);
        sendResponse({ status: 'done', filled: filledCount });
      });
      return true; // keep the message channel open
    }
  });

  console.log('[Smart Autofill] content script loaded ✅');
})();
