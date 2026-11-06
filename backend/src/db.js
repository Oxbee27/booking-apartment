import pg from "pg";
import { readFileSync } from "node:fs";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
}

const poolConnectionString = (() => {
  if (process.env.PGSSL !== "true") return connectionString;
  const url = new URL(connectionString);
  for (const parameter of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    url.searchParams.delete(parameter);
  }
  return url.toString();
})();
const sslCa = process.env.PGSSL_CA_BASE64
  ? Buffer.from(process.env.PGSSL_CA_BASE64, "base64").toString("utf8")
  : process.env.PGSSL_CA_CONTENT ||
    (process.env.PGSSL_CA
      ? readFileSync(process.env.PGSSL_CA, "utf8")
      : undefined);

if (
  process.env.PGSSL === "true" &&
  (!sslCa ||
    !sslCa.includes("-----BEGIN CERTIFICATE-----") ||
    !sslCa.includes("-----END CERTIFICATE-----"))
) {
  throw new Error(
    "PGSSL is enabled but no valid CA certificate was loaded. Set PGSSL_CA_BASE64 in Render to the base64-encoded Aiven CA certificate.",
  );
}

const pool = new Pool({
  connectionString: poolConnectionString,
  ssl:
    process.env.PGSSL === "true"
      ? {
          rejectUnauthorized: true,
          ...(sslCa ? { ca: sslCa } : {}),
        }
      : undefined,
});

function placeholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export const db = {
  query(sql, params = []) {
    return pool.query(placeholders(sql), params);
  },
  async exec(sql) {
    await pool.query(sql);
  },
  prepare(sql) {
    return {
      get: async (...params) => (await db.query(sql, params)).rows[0],
      all: async (...params) => (await db.query(sql, params)).rows,
      run: async (...params) => {
        const insert = /^\s*INSERT\b/i.test(sql);
        const statement =
          insert && !/\bRETURNING\b/i.test(sql) ? `${sql} RETURNING id` : sql;
        const result = await db.query(statement, params);
        return {
          changes: result.rowCount,
          lastInsertRowid: result.rows[0]?.id,
        };
      },
    };
  },
  async close() {
    await pool.end();
  },
};

await db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id SERIAL PRIMARY KEY, name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS apartments(
 id SERIAL PRIMARY KEY, title TEXT NOT NULL, city TEXT NOT NULL,
 address TEXT NOT NULL, description TEXT NOT NULL, price NUMERIC(12,2) NOT NULL,
 bedrooms INTEGER NOT NULL, bathrooms INTEGER NOT NULL, guests INTEGER NOT NULL,
 image TEXT NOT NULL, amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
 featured BOOLEAN NOT NULL DEFAULT FALSE, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bookings(
 id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
 apartment_id INTEGER NOT NULL REFERENCES apartments(id), check_in DATE NOT NULL,
 check_out DATE NOT NULL, guests INTEGER NOT NULL, total NUMERIC(12,2) NOT NULL,
 status TEXT NOT NULL DEFAULT 'confirmed', payment_reference TEXT UNIQUE,
 guest_name TEXT, guest_email TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inquiries(
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
 subject TEXT NOT NULL, message TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS newsletter_subscribers(
 id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE,
 consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`);

await db.exec(`
  ALTER TABLE apartments
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
`);

// Booking confirmation email tracking
await db.exec(`
  ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;

  ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmation_email_claimed_at TIMESTAMPTZ;
`);

await db.exec(`
  ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;

  ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

  ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

  ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_policy_accepted_at TIMESTAMPTZ;

  ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_policy_version TEXT;

  ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

  UPDATE bookings
  SET hold_expires_at = created_at + INTERVAL '30 minutes'
  WHERE hold_expires_at IS NULL;

  UPDATE bookings
  SET status = 'expired'
  WHERE status = 'pending' AND hold_expires_at <= NOW();
`);
