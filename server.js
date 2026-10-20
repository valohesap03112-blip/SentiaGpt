const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint: client sends { provider, key, model, messages, system }
app.post('/api/chat', async (req, res) => {
  const { provider, key, model, messages, system } = req.body || {};
  if (!provider || !key || !messages) {
    return res.status(400).json({ error: 'provider, key ve messages gerekli' });
  }

  try {
    let result;
    if (provider === 'anthropic') {
      result = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          system: system || '',
          messages,
        }),
      }).then(r => r.json());
      const text = (result.content || []).map(b => b.text || '').join('');
      return res.json({ text, raw: result });
    }

    if (provider === 'openai') {
      result = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        }),
      }).then(r => r.json());
      const text = result.choices?.[0]?.message?.content || '';
      return res.json({ text, raw: result });
    }

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.0-flash')}:generateContent?key=${key}`;
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      result = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
        }),
      }).then(r => r.json());
      const text = (result.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      return res.json({ text, raw: result });
    }

    return res.status(400).json({ error: 'Bilinmeyen sağlayıcı' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Sunucu hatası' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sentia sunucusu çalışıyor → http://localhost:${PORT}`);
});
