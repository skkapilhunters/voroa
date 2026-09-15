import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

export const initDB = async () => {
  const schemaSQL = `
    CREATE TABLE IF NOT EXISTS clans (
        tag VARCHAR(15) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        level INT,
        members INT,
        clan_points INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
        tag VARCHAR(15) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        clan_tag VARCHAR(15) REFERENCES clans(tag) ON DELETE SET NULL,
        town_hall INT,
        trophies INT,
        exp_level INT,
        data JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS war_logs (
        id SERIAL PRIMARY KEY,
        clan_tag VARCHAR(15) NOT NULL,
        opponent_tag VARCHAR(15),
        opponent_name VARCHAR(100),
        result VARCHAR(10),
        team_size INT,
        stars INT,
        opponent_stars INT,
        destruction_percentage NUMERIC(5,2),
        end_time TIMESTAMP NOT NULL,
        UNIQUE(clan_tag, end_time)
    );

    CREATE TABLE IF NOT EXISTS live_wars (
        clan_tag VARCHAR(15) PRIMARY KEY,
        state VARCHAR(20) NOT NULL,
        opponent_tag VARCHAR(15),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        war_data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cwl_groups (
        clan_tag VARCHAR(15) PRIMARY KEY,
        season VARCHAR(7) NOT NULL,
        state VARCHAR(20),
        group_data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_players_clan ON players(clan_tag);
    CREATE INDEX IF NOT EXISTS idx_war_logs_clan ON war_logs(clan_tag);
  `;

  try {
    await pool.query(schemaSQL);
    console.log('✅ PostgreSQL schema auto-initialized.');
  } catch (err) {
    console.error('❌ Error initializing PostgreSQL schema:', err.message);
    throw err;
  }
};

export default pool;
