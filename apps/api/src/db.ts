import pg from "pg";

export function createPool() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://xreviewer:xreviewer@127.0.0.1:5435/xreviewer";

  return new pg.Pool({
    connectionString,
    max: 10,
  });
}
