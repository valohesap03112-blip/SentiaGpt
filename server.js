const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Statik dosyaları sun
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Proxy endpoint
app.post('/api/chat', async (req, res) => {
  const { provider, key, model, messages, system } = req.body || {};

  if (!provider || !key || !messages) {
    return res.status(400).json({ error: 'provider, key ve messages gerekli' });
  }

  try {
    let result;

    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
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
      });
      result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Anthropic hatası');
      const text = (result.content || []).map(b => b.text || '').join('');
      return res.json({ text });
    }

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        }),
      });
      result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'OpenAI hatası');
      const text = result.choices?.[0]?.message?.content || '';
      return res.json({ text });
    }

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.0-flash')}:generateContent?key=${key}`;
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
        }),
      });
      result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Gemini hatası');
      const text = (result.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      return res.json({ text });
    }

    return res.status(400).json({ error: 'Bilinmeyen sağlayıcı: ' + provider });
  } catch (e) {
    console.error('API hatası:', e.message);
    res.status(500).json({ error: e.message || 'Sunucu hatası' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sentia sunucusu çalışıyor → port ${PORT}`);
});
