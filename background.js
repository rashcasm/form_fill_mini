// background.js - very small service worker for MV3
// Currently used for logging and possible future central tasks.
// Keep it minimal to avoid unnecessary background work.

self.addEventListener('install', (event) => {
  // service worker installed
  console.log('[SmartAutofill] service worker installed');
});

self.addEventListener('activate', (event) => {
  console.log('[SmartAutofill] service worker activated');
});

// Optionally handle long-lived tasks here later (rate-limiting, caching, etc.)
