document.addEventListener("DOMContentLoaded", () => {
  const fields = [
    "firstName",
    "lastName",
    "gender",
    "dob",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "zip",
    "company",
    "role",
    "linkedin",
    "github",
    "shortBio",
  ];

  const saveBtn = document.getElementById("saveBtn");
  const clearBtn = document.getElementById("clearBtn");
  const fillBtn = document.getElementById("fillBtn");
  const statusEl = document.getElementById("status");

  // Load saved data
  chrome.storage.local.get(["smartAutofillProfile"], (res) => {
    const p = res.smartAutofillProfile || {};
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el && p[id] !== undefined) el.value = p[id];
    });
  });

  // Save profile
  saveBtn.addEventListener("click", () => {
    const profile = {};
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) profile[id] = el.value.trim();
    });
    chrome.storage.local.set({ smartAutofillProfile: profile }, () => {
      statusEl.textContent = "Saved ✔";
      setTimeout(() => (statusEl.textContent = ""), 1500);
    });
  });

  // Clear all
  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear your saved profile?")) return;
    chrome.storage.local.remove("smartAutofillProfile", () => {
      fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      statusEl.textContent = "Cleared";
      setTimeout(() => (statusEl.textContent = ""), 1200);
    });
  });

  // Fill current page
  fillBtn.addEventListener("click", async () => {
    statusEl.textContent = "Filling...";
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.id) {
      statusEl.textContent = "No active tab";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM" }, (response) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = "Page not ready (or not allowed)";
        return;
      }
      statusEl.textContent = `Done (filled: ${response?.filled || 0})`;
      setTimeout(() => (statusEl.textContent = ""), 2000);
    });
  });

  document.getElementById("resumeBtn").addEventListener("click", () => {
    const api = typeof browser !== "undefined" ? browser : chrome;
    const windowUrl = api.runtime.getURL("popup/window.html");
    api.windows.create({
      url: windowUrl,
      type: "popup",
      width: 500,
      height: 600,
    });
  });
});
