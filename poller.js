import cron from 'node-cron';
import pool from './db.js';
import { fetchClan, fetchCurrentWar, fetchWarLog, fetchCWLGroup } from './coc.js';

function parseCoCTime(str) {
  if (!str) return null;
  const y = str.substring(0, 4), m = str.substring(4, 6), d = str.substring(6, 8);
  const h = str.substring(9, 11), min = str.substring(11, 13), s = str.substring(13, 15);
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
}

export const syncAllTrackedClans = async () => {
  try {
    const { rows: clans } = await pool.query('SELECT tag FROM clans');
    for (const clan of clans) {
      const tag = clan.tag;

      // 1. Refresh Clan & Member Data
      try {
        const { data: clanData } = await fetchClan(tag);
        await pool.query(
          `UPDATE clans SET name = $1, level = $2, members = $3, clan_points = $4, updated_at = NOW() WHERE tag = $5`,
          [clanData.name, clanData.clanLevel, clanData.members, clanData.clanPoints, tag]
        );
      } catch (e) { console.error(`Clan sync err (${tag}):`, e.message); }

      // 2. Refresh Live War
      try {
        const { data: war } = await fetchCurrentWar(tag);
        if (war && war.state !== 'notInWar') {
          await pool.query(
            `INSERT INTO live_wars (clan_tag, state, opponent_tag, start_time, end_time, war_data, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (clan_tag) DO UPDATE 
             SET state = $2, opponent_tag = $3, start_time = $4, end_time = $5, war_data = $6, updated_at = NOW()`,
            [
              tag,
              war.state,
              war.opponent?.tag || null,
              parseCoCTime(war.startTime),
              parseCoCTime(war.endTime),
              JSON.stringify(war)
            ]
          );
        }
      } catch (e) { console.error(`War sync err (${tag}):`, e.message); }

      // 3. Refresh War Log
      try {
        const { data: warlog } = await fetchWarLog(tag);
        if (warlog?.items) {
          for (const item of warlog.items) {
            if (!item.endTime) continue;
            await pool.query(
              `INSERT INTO war_logs (clan_tag, opponent_tag, opponent_name, result, team_size, stars, opponent_stars, destruction_percentage, end_time)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (clan_tag, end_time) DO NOTHING`,
              [
                tag,
                item.opponent?.tag || 'N/A',
                item.opponent?.name || 'Unknown',
                item.result || 'N/A',
                item.teamSize || 0,
                item.clan?.stars || 0,
                item.opponent?.stars || 0,
                item.clan?.destructionPercentage || 0,
                parseCoCTime(item.endTime)
              ]
            );
          }
        }
      } catch (e) { console.error(`Warlog sync err (${tag}):`, e.message); }

      // 4. Refresh CWL
      try {
        const { data: cwl } = await fetchCWLGroup(tag);
        if (cwl && cwl.state !== 'notInWar') {
          await pool.query(
            `INSERT INTO cwl_groups (clan_tag, season, state, group_data, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (clan_tag) DO UPDATE 
             SET season = $2, state = $3, group_data = $4, updated_at = NOW()`,
            [tag, cwl.season, cwl.state, JSON.stringify(cwl)]
          );
        }
      } catch (e) { /* Clan may not be in CWL */ }
    }
  } catch (err) {
    console.error('Poller error:', err.message);
  }
};

export const startPoller = () => {
  cron.schedule('*/3 * * * *', () => {
    console.log('🔄 Running scheduled CoC sync...');
    syncAllTrackedClans();
  });
};
