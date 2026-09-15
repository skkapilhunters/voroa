import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
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

    CREATE TABLE IF NOT EXISTS live_wars (
        clan_tag VARCHAR(15) PRIMARY KEY,
        state VARCHAR(20) NOT NULL,
        opponent_tag VARCHAR(15),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        war_data JSONB NOT NULL,
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
  `;

  await pool.query(schemaSQL);
  console.log('✅ PostgreSQL Schema initialized.');
};

export default pool;
