import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KV_KEY = 'survey_responses';

export default async function handler(req, res) {
  try {
    const raw = await redis.lrange(KV_KEY, 0, -1);
    const responses = raw.map(item =>
      typeof item === 'string' ? JSON.parse(item) : item
    );

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(responses);
  } catch (err) {
    console.error('Responses error:', err);
    return res.status(500).json({ error: err.message });
  }
}
