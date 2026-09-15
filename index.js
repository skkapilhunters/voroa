import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { initDB } from './db.js';
import { fetchClan, fetchPlayer } from './coc.js';
import { startPoller, syncAllTrackedClans } from './poller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for host deployment
app.get('/health', (req, res) => res.status(200).send('OK'));

// Track Clan Endpoint
app.post('/api/clans/track', async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ error: 'Clan tag is required' });

    const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
    const { data: clan } = await fetchClan(formattedTag);

    await pool.query(
      `INSERT INTO clans (tag, name, level, members, clan_points)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tag) DO UPDATE SET name = $2, level = $3, members = $4, clan_points = $5, updated_at = NOW()`,
      [clan.tag, clan.name, clan.clanLevel, clan.members, clan.clanPoints]
    );

    syncAllTrackedClans();
    res.json({ success: true, message: `Now tracking ${clan.name} (${clan.tag})` });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Fetch Tracked Clans
app.get('/api/clans', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clans ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database connection error: ' + err.message });
  }
});

// Fetch Dashboard Data
app.get('/api/dashboard/:tag', async (req, res) => {
  const tag = req.params.tag.startsWith('#') ? req.params.tag : `#${req.params.tag}`;

  try {
    const clanRes = await pool.query('SELECT * FROM clans WHERE tag = $1', [tag]);
    const liveWarRes = await pool.query('SELECT * FROM live_wars WHERE clan_tag = $1', [tag]);
    const warLogRes = await pool.query('SELECT * FROM war_logs WHERE clan_tag = $1 ORDER BY end_time DESC LIMIT 10', [tag]);

    let liveClanData = null;
    try {
      const apiRes = await fetchClan(tag);
      liveClanData = apiRes.data;
    } catch (e) {}

    res.json({
      clan: clanRes.rows[0] || liveClanData,
      liveMembers: liveClanData?.memberList || [],
      liveWar: liveWarRes.rows[0] ? liveWarRes.rows[0].war_data : null,
      warLog: warLogRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server First
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Safely attempt DB initialization
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ WARNING: DATABASE_URL environment variable is missing!');
      return;
    }
    await initDB();
    startPoller();
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err.message);
  }
});
