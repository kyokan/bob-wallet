import { app } from 'electron';
import bdb from 'bdb';
import path from 'path';

let db;

export async function open() {
  if (db) {
    return;
  }

  const loc = path.join(app.getPath('userData'), 'db');
  let tdb = bdb.create(loc);
  await tdb.open();
  db = tdb;
}

export async function close() {
  ensureDB();
  await db.close();
  db = null;
}

export async function put(key, value) {
  ensureDB();
  return db.put(Buffer.from(key, 'utf-8'), Buffer.from(JSON.stringify(value), 'utf-8'));
}

export async function get(key) {
  ensureDB();
  const data = await db.get(Buffer.from(key, 'utf-8'));
  if (data === null) {
    return null;
  }

  return JSON.parse(data.toString('utf-8'));
}

export async function del(key) {
  ensureDB();
  return db.del(Buffer.from(key, 'utf-8'));
}

export async function iteratePrefix(prefix, cb) {
  const gt = Buffer.from(prefix, 'utf-8');
  const iter = db.iterator({
    gt,
    lt: Buffer.concat([gt, Buffer.from([0xFF])]),
    values: true,
  });
  await iter.each(cb);
}

export async function getUserDir() {
  return app.getPath('userData');
}

function ensureDB() {
  if (!db) {
    throw new Error('db not open');
  }
}

const sName = 'DB';
const methods = {
  open,
  close,
  put,
  get,
  del,
  iteratePrefix,
  getUserDir,
};

export async function start(server) {
  await open();
  server.withService(sName, methods);
}

