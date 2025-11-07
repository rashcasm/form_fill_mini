// content.js
// Listens to messages from the popup and performs autofill on the page.
// Scans inputs, textareas, selects and attempts to match common fields.

(function () {
  // Utility: trigger events so page JS notices changes
  function triggerEvents(el) {
    ['input', 'change', 'blur'].forEach((name) => {
      const ev = new Event(name, { bubbles: true });
      el.dispatchEvent(ev);
    });
  }

  // Get the visible label text associated with an input if any
  function getLabelText(input) {
    if (!input) return '';
    // label via for attribute
    if (input.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (lab && lab.textContent) return lab.textContent.trim();
    }
    // label via ancestor <label>
    const parentLabel = input.closest('label');
    if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();

    // try to find a label by proximity: previous sibling or parent text
    const prev = input.previousElementSibling;
    if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'DIV' || prev.tagName === 'SPAN')) {
      return prev.textContent.trim();
    }
    // fallback: placeholder
    if (input.placeholder) return input.placeholder.trim();

    return '';
  }

  // Simple heuristics to determine if a field is "long answer"
  function isLongAnswerField(el) {
    if (el.tagName === 'TEXTAREA') return true;
    if (el.rows && el.rows > 3) return true;
    const label = getLabelText(el).toLowerCase();
    if (/why|about|experience|motivation|describe|tell us|cover letter|summary/.test(label)) return true;
    if ((el.placeholder || '').toLowerCase().match(/why|about|experience|motivation|describe/)) return true;
    return false;
  }

  // Fit best-matching profile value to an element using heuristics
  function mapValueToElement(el, profile) {
    const nameAttrs = (el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + getLabelText(el);
    const h = nameAttrs.toLowerCase();

    // Short fields mapping
    if (/email|e-mail/.test(h)) return profile.email || '';
    if (/first.*name|given.*name|full.*name|your name|name\b/.test(h)) return profile.name || '';
    if (/\bphone\b|mobile|tel|telephone/.test(h)) return profile.phone || '';
    if (/address|street|addr\b/.test(h)) return profile.address || '';
    if (/city|town/.test(h)) return profile.city || '';
    if (/company|organization|organisation|employer/.test(h)) return profile.company || '';
    if (/role|position|title|job/.test(h)) return profile.role || '';
    if (/linkedin|github|portfolio/.test(h)) return profile.links || '';

    // If long-answer field: use profile.shortBio as fallback (generation happens later)
    if (isLongAnswerField(el)) {
      // In this basic version we just use shortBio if present.
      return profile.shortBio || '';
    }

    // No mapping found
    return null;
  }

  // Fill fields using the profile object
  async function fillWithProfile(profile) {
    const all = Array.from(document.querySelectorAll('input, textarea, select'));
    let filled = 0;

    all.forEach((el) => {
      // ignore inputs of type hidden, submit, button, file, password
      const t = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'file', 'password', 'image'].includes(t)) return;

      const mapped = mapValueToElement(el, profile);
      if (mapped === null) return;

      // If it's a select, try to select option that matches the value
      if (el.tagName === 'SELECT') {
        for (const opt of el.options) {
          if (opt.value && typeof mapped === 'string' && opt.value.toLowerCase().includes(mapped.toLowerCase())) {
            el.value = opt.value;
            triggerEvents(el);
            filled++;
            return;
          }
          if (opt.text && typeof mapped === 'string' && opt.text.toLowerCase().includes(mapped.toLowerCase())) {
            el.value = opt.value;
            triggerEvents(el);
            filled++;
            return;
          }
        }
        return;
      }

      // Fill text-like input or textarea
      if (typeof mapped === 'string' && mapped.length > 0) {
        el.focus();
        el.value = mapped;
        triggerEvents(el);
        filled++;
      }
    });

    return filled;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'FILL_FORM') {
      // fetch profile from storage and fill
      chrome.storage.local.get(['smartAutofillProfile'], (result) => {
        const profile = result.smartAutofillProfile || {};
        const filledCount = fillWithProfile(profile);
        sendResponse({ status: 'done', filled: filledCount });
      });
      // returning true to indicate async sendResponse
      return true;
    }
  });

  // Optional: content script can offer a small floating UI near forms later
})();
