const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'))
for (const k in envConfig) {
  process.env[k] = envConfig[k]
}

async function test() {
  console.log('Testing with model:', process.env.OPENROUTER_MODEL);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL,
        messages: [{role: 'user', content: 'Merhaba Anıtkabir nerede?'}],
      })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('Error:', e);
  }
}

test();
