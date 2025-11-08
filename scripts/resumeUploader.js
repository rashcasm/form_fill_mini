// resumeUploader.js
const OCR_API_KEY = "__"; // Replace with your real key

document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("resumeFile");
  const status = document.getElementById("status");
  const preview = document.getElementById("preview");
  const output = document.getElementById("output");
  const saveBtn = document.getElementById("saveBtn");

  let extractedProfile = {};

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return alert("Please choose a PDF file.");

    status.textContent = "Uploading and extracting text...";
    const formData = new FormData();
    formData.append("apikey", OCR_API_KEY);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("file", file);

    try {
      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      const parsedText = data?.ParsedResults?.[0]?.ParsedText || "";
      if (!parsedText) throw new Error("No text found in resume.");

      extractedProfile = parseResumeText(parsedText);
      output.textContent = JSON.stringify(extractedProfile, null, 2);
      preview.classList.remove("hidden");
      status.textContent = "✅ Extraction complete!";
    } catch (err) {
      console.error(err);
      status.textContent = "❌ Failed to extract. Try again.";
    }
  });

  saveBtn.addEventListener("click", () => {
    chrome.storage.local.set({ smartAutofillProfile: extractedProfile }, () => {
      status.textContent = "Profile updated from resume ✔";
      setTimeout(() => (status.textContent = ""), 2000);
    });
  });
});

// Basic resume text parsing (improvable later)
function parseResumeText(text) {
  const profile = {};
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(Boolean);

  profile.email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)?.[0] || "";
  profile.phone = text.match(/(\+?\d[\d\s\-]{7,15})/)?.[0] || "";
  profile.linkedin = text.match(/linkedin\.com\/in\/[A-Za-z0-9-]+/)?.[0] || "";
  profile.github = text.match(/github\.com\/[A-Za-z0-9-]+/)?.[0] || "";

  // Try to guess full name (first line heuristic)
  profile.firstName = lines[0]?.split(" ")[0] || "";
  profile.lastName = lines[0]?.split(" ")[1] || "";

  // Try company or role keywords
  const roleMatch = text.match(/\b(Engineer|Developer|Manager|Intern|Designer)\b/i);
  profile.role = roleMatch ? roleMatch[0] : "";

  const companyMatch = text.match(/\b(?:at|@)\s+([A-Z][A-Za-z0-9&\s]+)/);
  profile.company = companyMatch ? companyMatch[1].trim() : "";

  // Short bio or summary
  const summaryIndex = text.toLowerCase().indexOf("summary");
  if (summaryIndex !== -1) {
    profile.shortBio = text.slice(summaryIndex, summaryIndex + 300).trim();
  }

  return profile;
}
