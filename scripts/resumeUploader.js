// resumeUploader.js
const OCR_API_KEY = "___"; // Replace with your real key

document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("resumeFile");
  const status = document.getElementById("status");
  const preview = document.getElementById("preview");
  const output = document.getElementById("output");
  const saveBtn = document.getElementById("saveBtn");

  // Use browser.* (Firefox) with chrome.* fallback
  const api = typeof browser !== "undefined" ? browser : chrome;

  let extractedProfile = {};

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please choose a PDF file.");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Only PDF files are supported.");
      return;
    }

    // 1 MB limit for OCR.Space free tier
    if (file.size > 1024 * 1024) {
      status.textContent =
        "⚠️ File too large. Free OCR tier supports up to 1 MB.";
      console.warn(
        "[ResumeUploader] File size:",
        file.size,
        "bytes — exceeds 1 MB limit.",
      );
      return;
    }

    status.textContent = "Uploading and extracting text...";
    console.log(
      "[ResumeUploader] Starting upload for:",
      file.name,
      "size:",
      file.size,
    );

    const formData = new FormData();
    formData.append("apikey", OCR_API_KEY);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("filetype", "PDF");
    formData.append("file", file);

    try {
      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
      });

      console.log("[ResumeUploader] API response status:", res.status);

      if (!res.ok) {
        throw new Error(
          `OCR API returned HTTP ${res.status}: ${res.statusText}`,
        );
      }

      const data = await res.json();
      console.log(
        "[ResumeUploader] API response data:",
        JSON.stringify(data).slice(0, 500),
      );

      if (data.IsErroredOnProcessing) {
        const errMsg =
          data.ErrorMessage?.join(", ") || "Unknown processing error";
        throw new Error(`OCR processing error: ${errMsg}`);
      }

      if (data.OCRExitCode && data.OCRExitCode !== 1) {
        console.warn("[ResumeUploader] OCR exit code:", data.OCRExitCode);
      }

      const parsedText = data?.ParsedResults?.[0]?.ParsedText || "";
      console.log("[ResumeUploader] Parsed text length:", parsedText.length);
      console.log(
        "[ResumeUploader] Parsed text preview:",
        parsedText.slice(0, 300),
      );

      if (!parsedText || parsedText.trim().length === 0) {
        throw new Error(
          "No text could be extracted from the PDF. The file may be image-based or empty.",
        );
      }

      extractedProfile = parseResumeText(parsedText);
      console.log("[ResumeUploader] Extracted profile:", extractedProfile);

      output.textContent = JSON.stringify(extractedProfile, null, 2);
      preview.classList.remove("hidden");
      status.textContent = "✅ Extraction complete!";
    } catch (err) {
      console.error("[ResumeUploader] Error:", err);
      status.textContent =
        "❌ " + (err.message || "Failed to extract. Try again.");
    }
  });

  saveBtn.addEventListener("click", () => {
    if (!extractedProfile || Object.keys(extractedProfile).length === 0) {
      status.textContent = "⚠️ No extracted data to save.";
      return;
    }

    console.log(
      "[ResumeUploader] Saving profile to storage:",
      extractedProfile,
    );

    api.storage.local.set({ smartAutofillProfile: extractedProfile }, () => {
      if (api.runtime.lastError) {
        console.error("[ResumeUploader] Storage error:", api.runtime.lastError);
        status.textContent =
          "❌ Failed to save: " + api.runtime.lastError.message;
        return;
      }
      status.textContent = "Profile updated from resume ✔";
      console.log("[ResumeUploader] Profile saved successfully.");
      setTimeout(() => (status.textContent = ""), 2000);
    });
  });
});

// Basic resume text parsing (improvable later)
function parseResumeText(text) {
  const profile = {};
  const lines = text
    .split(/\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean);

  profile.email =
    text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)?.[0] || "";
  profile.phone = text.match(/(\+?\d[\d\s\-]{7,15})/)?.[0]?.trim() || "";
  profile.linkedin = text.match(/linkedin\.com\/in\/[A-Za-z0-9_-]+/)?.[0] || "";
  profile.github = text.match(/github\.com\/[A-Za-z0-9_-]+/)?.[0] || "";

  // Try to guess full name (first non-empty line heuristic)
  const nameLine = lines[0] || "";
  const nameParts = nameLine.split(/\s+/);
  profile.firstName = nameParts[0] || "";
  profile.lastName = nameParts.slice(1).join(" ") || "";

  // Try company or role keywords
  const roleMatch = text.match(
    /\b(Engineer|Developer|Manager|Intern|Designer|Analyst|Consultant|Architect|Lead|Director)\b/i,
  );
  profile.role = roleMatch ? roleMatch[0] : "";

  const companyMatch = text.match(/\b(?:at|@)\s+([A-Z][A-Za-z0-9&\s]+)/);
  profile.company = companyMatch ? companyMatch[1].trim() : "";

  // Short bio or summary
  const summaryMatch = text.match(
    /(?:summary|about|objective|profile)\s*[:\-]?\s*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i,
  );
  if (summaryMatch) {
    profile.shortBio = summaryMatch[1].trim();
  } else {
    const summaryIndex = text.toLowerCase().indexOf("summary");
    if (summaryIndex !== -1) {
      profile.shortBio = text.slice(summaryIndex, summaryIndex + 300).trim();
    }
  }

  // Address / city / state heuristics (best-effort)
  profile.address = "";
  profile.city = "";
  profile.state = "";
  profile.zip = "";
  profile.gender = "";
  profile.dob = "";

  return profile;
}
