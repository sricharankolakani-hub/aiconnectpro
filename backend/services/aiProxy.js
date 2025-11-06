// backend/services/aiProxy.js
// Simple server-side proxy to OpenAI Chat Completions
// Uses global fetch (Node 18+). Returns a string reply.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'; // change if you want another model

async function callOpenAI(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('openai_key_missing');

  // Build chat messages: system + user
  const system = options.system || 'You are a helpful assistant for AIConnect Pro. Provide concise, factual answers.';
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: String(prompt) }
  ];

  const body = {
    model: MODEL,
    messages,
    max_tokens: options.max_tokens || 512,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.2,
    n: 1
  };

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    const e = new Error('OpenAI API error');
    e.status = res.status;
    e.body = text;
    throw e;
  }

  const data = await res.json();
  // Chat completion result shape: data.choices[0].message.content
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('invalid_openai_response');
  }
  return data.choices[0].message.content.trim();
}

module.exports = { callOpenAI };
