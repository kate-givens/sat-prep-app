export default async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL_NAME = 'gemini-2.5-flash';
  
    if (!API_KEY) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });
    }
  
    try {
      const googleRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body), // forward the body from the client
        }
      );
  
      const text = await googleRes.text();
  
      // Forward status + body exactly as Google sent it.
      res.status(googleRes.status);
      // If response is JSON, pass as JSON; otherwise just send text
      try {
        const data = JSON.parse(text);
        return res.json(data);
      } catch {
        return res.send(text);
      }
    } catch (err) {
      console.error('Gemini proxy error:', err);
      return res.status(500).json({
        error: 'Server error while calling Gemini',
        details: err.message,
      });
    }
  }
  