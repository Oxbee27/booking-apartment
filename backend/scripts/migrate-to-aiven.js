import "dotenv/config";
import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmodSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { Pool } = pg;
const execFileAsync = promisify(execFile);
const tableNames = [
  "users",
  "apartments",
  "bookings",
  "inquiries",
  "newsletter_subscribers",
];

function connectionParts(connectionString) {
  const url = new URL(connectionString);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
}

function getAivenConnectionString() {
  if (process.env.AIVEN_DATABASE_URL) return process.env.AIVEN_DATABASE_URL;

  const { AIVEN_HOST, AIVEN_PORT, AIVEN_DATABASE, AIVEN_USER, AIVEN_PASSWORD } =
    process.env;
  if (
    !AIVEN_HOST ||
    !AIVEN_PORT ||
    !AIVEN_DATABASE ||
    !AIVEN_USER ||
    !AIVEN_PASSWORD
  ) {
    return "";
  }

  return `postgresql://${encodeURIComponent(AIVEN_USER)}:${encodeURIComponent(AIVEN_PASSWORD)}@${AIVEN_HOST}:${AIVEN_PORT}/${encodeURIComponent(AIVEN_DATABASE)}`;
}

function migrationPool(connectionString, ca) {
  return new Pool({
    connectionString,
    ssl: { ca, rejectUnauthorized: true },
  });
}

async function getRowCounts(pool) {
  const counts = {};
  for (const tableName of tableNames) {
    const result = await pool.query(
      `SELECT count(*)::int AS count FROM ${tableName}`,
    );
    counts[tableName] = result.rows[0].count;
  }
  return counts;
}

async function runPgTool(tool, args, connection, sslEnvironment = {}) {
  await execFileAsync(tool, args, {
    env: {
      ...process.env,
      ...connection,
      ...sslEnvironment,
    },
    maxBuffer: 10 * 1024 * 1024,
  });
}

const sourceUrl =
  process.env.MIGRATION_SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const targetUrl = getAivenConnectionString();
const caPath = process.env.AIVEN_SSL_CA || process.env.PGSSL_CA;

if (!sourceUrl || !targetUrl || !caPath) {
  console.error(
    "Set DATABASE_URL or MIGRATION_SOURCE_DATABASE_URL (source), AIVEN_HOST, AIVEN_PORT, AIVEN_DATABASE, AIVEN_USER, AIVEN_PASSWORD, and AIVEN_SSL_CA in backend/.env. You may use AIVEN_DATABASE_URL instead of the five connection fields.",
  );
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.error("Source and Aiven destination must be different databases.");
  process.exit(1);
}

let ca;
try {
  ca = readFileSync(caPath, "utf8");
} catch {
  console.error("Could not read the Aiven CA certificate at PGSSL_CA.");
  process.exit(1);
}

const sourcePool = new Pool({ connectionString: sourceUrl });
const targetPool = migrationPool(targetUrl, ca);
const workDirectory = mkdtempSync(join(tmpdir(), "staynest-aiven-"));
const archivePath = join(workDirectory, "database.dump");

try {
  const targetTables = await targetPool.query(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  );
  if (targetTables.rows[0].count !== 0) {
    throw new Error(
      "Aiven destination is not empty. Use a new empty database; no data was changed.",
    );
  }

  const sourceCounts = await getRowCounts(sourcePool);
  console.log(
    "Source database is reachable. Creating a protected temporary archive...",
  );
  await runPgTool(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      `--file=${archivePath}`,
      `--dbname=${connectionParts(sourceUrl).PGDATABASE}`,
    ],
    connectionParts(sourceUrl),
    { PGSSLMODE: "disable" },
  );
  chmodSync(archivePath, 0o600);

  console.log("Restoring to Aiven...");
  await runPgTool(
    "pg_restore",
    [
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-acl",
      `--dbname=${connectionParts(targetUrl).PGDATABASE}`,
      archivePath,
    ],
    connectionParts(targetUrl),
    { PGSSLMODE: "verify-full", PGSSLROOTCERT: caPath },
  );

  const targetCounts = await getRowCounts(targetPool);
  for (const tableName of tableNames) {
    if (sourceCounts[tableName] !== targetCounts[tableName]) {
      throw new Error(
        `Row count mismatch for ${tableName}: source ${sourceCounts[tableName]}, Aiven ${targetCounts[tableName]}.`,
      );
    }
  }

  console.log("Migration verified. Table row counts:");
  for (const tableName of tableNames) {
    console.log(`  ${tableName}: ${targetCounts[tableName]}`);
  }
  console.log(
    "Set DATABASE_URL to the Aiven URL and PGSSL=true to switch the backend.",
  );
} catch (error) {
  console.error(`Migration stopped: ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all([sourcePool.end(), targetPool.end()]);
  rmSync(workDirectory, { recursive: true, force: true });
}
