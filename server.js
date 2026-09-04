import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__name);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const CLIENT_BASE = 'http://127.0.0.1:8080';

// Proxy to bondlink-client
const proxy = async (req, res, method) => {
  try {
    const url = `${CLIENT_BASE}/api${req.path}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (method !== 'GET') {
      opts.body = JSON.stringify(req.body || {});
    }
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ success: false, error: 'BondLink client is not running. Start bondlink-client.exe first.' });
  }
};

app.get('/api/bonding/status', (req, res) => proxy(req, res, 'GET'));
app.post('/api/bonding/activate', (req, res) => proxy(req, res, 'POST'));
app.post('/api/bonding/deactivate', (req, res) => proxy(req, res, 'POST'));
app.post('/api/speedtest', (req, res) => proxy(req, res, 'GET'));

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BondLink Dashboard proxy running on http://localhost:${PORT}`);
  console.log(`BondLink client expected at ${CLIENT_BASE}`);
});
