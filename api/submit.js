import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KV_KEY = 'survey_responses';
const MAX_KEYS = 200;
const MAX_VAL = 5000;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    if (Object.keys(data).length > MAX_KEYS) {
      return res.status(400).json({ error: 'Too many fields' });
    }

    const sanitized = {};
    for (const [k, v] of Object.entries(data)) {
      sanitized[String(k).slice(0, 300)] = String(v ?? '').slice(0, MAX_VAL);
    }
    sanitized._submitted_at = new Date().toISOString();

    await redis.rpush(KV_KEY, JSON.stringify(sanitized));
    const total = await redis.llen(KV_KEY);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ status: 'ok', total });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: err.message });
  }
}
