import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
const dataDir=path.resolve('data');
fs.mkdirSync(dataDir,{recursive:true});
export const db=new Database(path.join(dataDir,'staynest.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS apartments(
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, city TEXT NOT NULL,
 address TEXT NOT NULL, description TEXT NOT NULL, price REAL NOT NULL,
 bedrooms INTEGER NOT NULL, bathrooms INTEGER NOT NULL, guests INTEGER NOT NULL,
 image TEXT NOT NULL, amenities TEXT NOT NULL, featured INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bookings(
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
 apartment_id INTEGER NOT NULL REFERENCES apartments(id), check_in TEXT NOT NULL,
 check_out TEXT NOT NULL, guests INTEGER NOT NULL, total REAL NOT NULL,
 status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);
