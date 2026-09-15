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

// Add a new clan to track
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

    // Initial sync for this clan
    syncAllTrackedClans();

    res.json({ success: true, message: `Now tracking ${clan.name} (${clan.tag})` });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Get tracked clans list
app.get('/api/clans', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clans ORDER BY name ASC');
  res.json(rows);
});

// Get full dashboard data for a tracked clan
app.get('/api/dashboard/:tag', async (req, res) => {
  const tag = req.params.tag.startsWith('#') ? req.params.tag : `#${req.params.tag}`;

  try {
    const clanRes = await pool.query('SELECT * FROM clans WHERE tag = $1', [tag]);
    const liveWarRes = await pool.query('SELECT * FROM live_wars WHERE clan_tag = $1', [tag]);
    const warLogRes = await pool.query('SELECT * FROM war_logs WHERE clan_tag = $1 ORDER BY end_time DESC LIMIT 10', [tag]);
    const cwlRes = await pool.query('SELECT * FROM cwl_groups WHERE clan_tag = $1', [tag]);

    // Live CoC API fallback if DB doesn't have details yet
    let liveClanData = null;
    try {
      const apiRes = await fetchClan(tag);
      liveClanData = apiRes.data;
    } catch (e) {}

    res.json({
      clan: clanRes.rows[0] || liveClanData,
      liveMembers: liveClanData?.memberList || [],
      liveWar: liveWarRes.rows[0] ? liveWarRes.rows[0].war_data : null,
      warLog: warLogRes.rows,
      cwl: cwlRes.rows[0] ? cwlRes.rows[0].group_data : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search Player directly from CoC API
app.get('/api/player/:tag', async (req, res) => {
  try {
    const tag = req.params.tag.startsWith('#') ? req.params.tag : `#${req.params.tag}`;
    const { data: player } = await fetchPlayer(tag);
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

async function start() {
  await initDB();
  startPoller();
  app.listen(PORT, () => console.log(`🚀 CoC Hybrid Platform running on port ${PORT}`));
}

start();
