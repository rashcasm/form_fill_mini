// ⚠️ Hardcode your OpenRouter API key here
const OPENROUTER_API_KEY = "___";

// ✅ Use your preferred OSS model (stable)
const MODEL = "openai/gpt-oss-20b:free";

async function generateAIResponse(prompt) {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://openrouter.ai",
          "X-Title": "Smart Autofill",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that writes concise, natural, professional responses for form fields.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.error(`[AI] API Error (${response.status})`);
      return `⚠️ API Error (${response.status})`;
    }

    const data = await response.json();
    const aiText = data?.choices?.[0]?.message?.content?.trim();
    return aiText || "⚠️ No response from AI.";
  } catch (err) {
    console.error("AI Request failed:", err);
    return "⚠️ Error contacting AI service.";
  }
}

// Handle messages from content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AI_GENERATE") {
    generateAIResponse(msg.prompt).then((result) => {
      sendResponse({ result });
    });
    return true; // keep async channel open
  }
});
