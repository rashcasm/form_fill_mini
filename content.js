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

  // Add this helper function for gender matching
  function matchGenderOption(optionText, gender) {
    const text = optionText.toLowerCase().trim();
    const genderValue = gender.toLowerCase().trim();

    if (text === genderValue) return true;
    if (genderValue === "male" && ["m", "man", "male"].includes(text)) return true;
    if (genderValue === "female" && ["f", "woman", "female"].includes(text)) return true;
    if (
      genderValue === "other" &&
      ["other", "others", "prefer not to say", "non-binary", "not specified", "not willing to disclose"].includes(text)
    )
      return true;

    return false;
  }

  // Detect long-answer (textarea) fields
  function isLongAnswerField(el) {
    if (el.tagName === "TEXTAREA") return true;
    if (el.rows && el.rows > 3) return true;
    const text = (getLabelText(el) + " " + (el.placeholder || "")).toLowerCase();
    return /(why|about|experience|motivation|describe|summary|cover|statement|bio|yourself|comments|details)/.test(text);
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
    if (/\bfirst.*name/.test(h)) return profile.firstName || "";
    if (/\blast.*name/.test(h)) return profile.lastName || "";
    if (/\bfull.*name|name\b/.test(h))
      return `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "";
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
      return new Date(profile.dob).toLocaleString("default", { month: "long" });
    if (/\b(year|yyyy)\b/.test(h) && profile.dob) return new Date(profile.dob).getFullYear().toString();

    return null;
  }

  // Fill dropdown (select)
  function fillSelect(el, value) {
    if (!value) return false;
    const val = value.toLowerCase();

    for (const opt of el.options) {
      if (opt.value && opt.value.toLowerCase() === val) {
        el.value = opt.value;
        triggerEvents(el);
        return true;
      }
    }

    if (
      el.name?.toLowerCase().includes("gender") ||
      el.id?.toLowerCase().includes("gender") ||
      getLabelText(el).toLowerCase().includes("gender")
    ) {
      for (const opt of el.options) {
        if (matchGenderOption(opt.text, value) || matchGenderOption(opt.value, value)) {
          el.value = opt.value;
          triggerEvents(el);
          return true;
        }
      }
    }

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

    if (el.tagName === "SELECT") return fillSelect(el, value);

    if (["INPUT", "TEXTAREA"].includes(el.tagName)) {
      const type = (el.type || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "file", "password"].includes(type)) return false;
      el.focus();
      el.value = value;
      triggerEvents(el);
      return true;
    }

    if (el.getAttribute("contenteditable") === "true") {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    return false;
  }

  //  AI Integration via background.js
  async function getAIResponse(prompt) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "AI_GENERATE", prompt }, (res) => {
        resolve(res?.result || "⚠️ No response from AI.");
      });
    });
  }

  // Fill all fields (with AI + profile)
  async function fillWithProfile(profile) {
    const all = Array.from(
      document.querySelectorAll(
        'input, textarea, select, [contenteditable="true"][role="textbox"], [aria-label][contenteditable="true"]'
      )
    );

    let filled = 0;

    for (const el of all) {
      const mapped = mapValueToElement(el, profile);

      // Handle long-answer fields using AI
      if (isLongAnswerField(el) && (!el.value || el.value.trim() === "")) {
        const question = getLabelText(el) || el.placeholder || "Write a professional answer";
        const profileText = JSON.stringify(profile, null, 2);

        const prompt = `
You are a helpful AI assistant writing short, natural, professional answers for form fields.
Question: "${question}"
User profile: ${profileText}
Write a short professional response.`;

        fillElement(el, "⏳ Generating answer with AI...");
        try {
          const aiText = await getAIResponse(prompt);
          fillElement(el, aiText);
          console.log("🤖 AI filled:", question);
        } catch (err) {
          console.error("AI generation failed:", err);
          fillElement(el, "⚠️ AI generation failed.");
        }
        continue;
      }

      // 🧍 Normal profile-based autofill
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
