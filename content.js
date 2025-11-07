// content.js — Universal Autofill (now with dropdown + DOB support)

(function () {
  console.log("[Smart Autofill] Content script loaded ✅");

  // Fire events so frameworks detect value changes
  function triggerEvents(el) {
    ["input", "change", "blur"].forEach((evt) =>
      el.dispatchEvent(new Event(evt, { bubbles: true }))
    );
  }

  // Extract label text or placeholder
  function getLabelText(input) {
    if (!input) return "";
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label && label.textContent) return label.textContent.trim();
    }
    const parentLabel = input.closest("label");
    if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();
    const prev = input.previousElementSibling;
    if (prev && ["LABEL", "DIV", "SPAN", "P", "STRONG"].includes(prev.tagName))
      return prev.textContent.trim();
    return input.placeholder ? input.placeholder.trim() : "";
  }

  // Detect long-answer (textarea) fields
  function isLongAnswerField(el) {
    if (el.tagName === "TEXTAREA") return true;
    if (el.rows && el.rows > 3) return true;
    const text = (getLabelText(el) + " " + (el.placeholder || "")).toLowerCase();
    return /(why|about|experience|motivation|describe|summary|cover|statement|bio)/.test(text);
  }

  // Try to find best-matched value from profile
  function mapValueToElement(el, profile) {
    const attrs = [
      el.name,
      el.id,
      el.placeholder,
      getLabelText(el),
      el.getAttribute("aria-label"),
    ]
      .join(" ")
      .toLowerCase();

    const h = attrs.replace(/[^a-z0-9\s]/g, " ");

    if (/\bemail\b|e[-\s]?mail/.test(h)) return profile.email || "";
    if (/\b(first|full|given).*name|name\b/.test(h)) return profile.firstName || profile.name || "";
    if (/\blast.*name/.test(h)) return profile.lastName || "";
    if (/\bphone\b|mobile|tel|contact/.test(h)) return profile.phone || "";
    if (/\baddress|street|location/.test(h)) return profile.address || "";
    if (/\bcity|town/.test(h)) return profile.city || "";
    if (/\bstate|region|province/.test(h)) return profile.state || "";
    if (/\bzip|postal|pincode/.test(h)) return profile.zip || "";
    if (/\bcompany|organization|organisation|employer/.test(h)) return profile.company || "";
    if (/\brole|position|title|job/.test(h)) return profile.role || "";
    if (/\blinkedin/.test(h)) return profile.linkedin || "";
    if (/\bgithub|portfolio|website/.test(h)) return profile.github || "";
    if (/\bgender\b|sex\b/.test(h)) return profile.gender || "";
    if (/\bbio|about|summary|motivation/.test(h)) return profile.shortBio || "";

    // DOB-related dropdowns (day, month, year)
    if (/\b(day|dd)\b/.test(h) && profile.dob) return new Date(profile.dob).getDate().toString();
    if (/\b(month|mm)\b/.test(h) && profile.dob)
      return new Date(profile.dob).toLocaleString("default", { month: "long" }); // "January"
    if (/\b(year|yyyy)\b/.test(h) && profile.dob) return new Date(profile.dob).getFullYear().toString();

    return null;
  }

  // Fill dropdown (select)
  function fillSelect(el, value) {
    if (!value) return false;
    const val = value.toLowerCase();

    // Try to match by value attribute
    for (const opt of el.options) {
      if (opt.value && opt.value.toLowerCase() === val) {
        el.value = opt.value;
        triggerEvents(el);
        return true;
      }
    }

    // Try to match by text content
    for (const opt of el.options) {
      if (opt.text && opt.text.toLowerCase().includes(val)) {
        el.value = opt.value;
        triggerEvents(el);
        return true;
      }
    }

    return false;
  }

  // Fill input / textarea / select / contenteditable
  function fillElement(el, value) {
    if (!value) return false;

    // Dropdown
    if (el.tagName === "SELECT") return fillSelect(el, value);

    // Normal input or textarea
    if (["INPUT", "TEXTAREA"].includes(el.tagName)) {
      const type = (el.type || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "file", "password"].includes(type)) return false;
      el.focus();
      el.value = value;
      triggerEvents(el);
      return true;
    }

    // Google Forms / contenteditable
    if (el.getAttribute("contenteditable") === "true") {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    return false;
  }

  // Fill all fields
  async function fillWithProfile(profile) {
    const all = Array.from(
      document.querySelectorAll(
        'input, textarea, select, [contenteditable="true"][role="textbox"], [aria-label][contenteditable="true"]'
      )
    );

    let filled = 0;

    for (const el of all) {
      const mapped = mapValueToElement(el, profile);
      if (!mapped) continue;
      if (fillElement(el, mapped)) filled++;
    }

    return filled;
  }

  // Listen for popup message
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "FILL_FORM") {
      chrome.storage.local.get(["smartAutofillProfile"], async (res) => {
        const profile = res.smartAutofillProfile || {};
        const filledCount = await fillWithProfile(profile);
        sendResponse({ status: "done", filled: filledCount });
      });
      return true;
    }
  });
})();
