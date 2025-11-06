// backend/services/aiProxy.js
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callOpenAI(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('openai_key_missing');

  const system = options.system || 'You are a helpful assistant for AIConnect Pro.';
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: String(prompt) }
  ];

  const body = {
    model: MODEL,
    messages,
    max_tokens: options.max_tokens || 256, // reduce default to lower cost
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.2,
    n: 1
  };

  // simple retry for transient errors (429/5xx). Exponential backoff.
  const maxAttempts = 3;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('invalid_openai_response');
      }
      return data.choices[0].message.content.trim();
    }

    // If 429 or >=500, we retry after backoff. For 400-level other than 429, throw immediately.
    if (res.status === 429 || res.status >= 500) {
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
      await sleep(waitMs);
      // try again
      if (attempt === maxAttempts) {
        const text = await res.text();
        const e = new Error('openai_retry_failed');
        e.status = res.status;
        e.body = text;
        throw e;
      } else {
        continue;
      }
    } else {
      // non-retriable (e.g., 401 invalid key, 400 bad request)
      const text = await res.text();
      const e = new Error('openai_error_nonretriable');
      e.status = res.status;
      e.body = text;
      throw e;
    }
  } // loop
}

module.exports = { callOpenAI };
