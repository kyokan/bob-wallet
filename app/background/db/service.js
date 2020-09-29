import { app } from 'electron';
import bdb from 'bdb';
import path from 'path';

let db;
let nameDB;

export async function open() {
  if (db) {
    return;
  }

  const loc = path.join(app.getPath('userData'), 'db');
  const nameDBloc = path.join(app.getPath('userData'), 'namedb');
  const tdb = bdb.create(loc);
  await tdb.open();
  db = tdb;

  const ndb = bdb.create(nameDBloc);
  await ndb.open();
  nameDB = ndb;
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

export async function addName(net, hash, name) {
  ensureDB();
  const hashBuf = Buffer.from(`${net}:${hash}`, 'utf-8');
  const nameBuf = Buffer.from(name, 'utf-8');

  return nameDB.put(hashBuf, nameBuf);
}

export async function getName(net, hash) {
  ensureDB();
  const hashBuf = Buffer.from(`${net}:${hash}`, 'utf-8');
  const data = await nameDB.get(hashBuf);

  if (data === null) {
    return null;
  }

  return data.toString('utf-8');
}

function ensureDB() {
  if (!db) {
    throw new Error('db not open');
  }

  if (!nameDB) {
    throw new Error('nameDB not open');
  }
}

const sName = 'DB';
const methods = {
  open,
  close,
  put,
  get,
  del,
  addName,
  getName,
};

export async function start(server) {
  await open();
  server.withService(sName, methods);
}

