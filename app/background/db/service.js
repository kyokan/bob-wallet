import { app } from 'electron';
import bdb from 'bdb';
const path = require('path');
import fs from 'fs';

let db;
let nameDB;
let headerDB;

export async function open() {
  if (db) {
    return;
  }

  const loc = path.join(app.getPath('userData'), 'db');
  const nameDBloc = path.join(app.getPath('userData'), 'namedb');
  const headerDBloc = path.join(app.getPath('userData'), 'headerdb');

  const tdb = bdb.create(loc);
  await tdb.open();
  db = tdb;

  const ndb = bdb.create(nameDBloc);
  await ndb.open();
  nameDB = ndb;

  const hdb = bdb.create(headerDBloc);
  await hdb.open();
  headerDB = hdb;
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

export async function getName(net = 'main', hash) {
  ensureDB();
  const hashBuf = Buffer.from(`${net}:${hash}`, 'utf-8');
  const data = await nameDB.get(hashBuf);

  if (data === null) {
    return null;
  }

  return data.toString('utf-8');
}

export async function addHeader(net = 'main', height, entry) {
  ensureDB();
  const keyBuf = Buffer.from(`${net}:${height}`, 'utf-8');
  const valBuf = Buffer.from(JSON.stringify(entry), 'utf-8');
  return headerDB.put(keyBuf, valBuf);
}

export async function getHeader(net = 'main', height) {
  ensureDB();
  const keyBuf = Buffer.from(`${net}:${height}`, 'utf-8');
  const data = await headerDB.get(keyBuf);

  if (data === null) {
    return null;
  }

  return JSON.parse(data.toString('utf-8'));
}

export async function setAddresses(net = 'main', walletId, addresses) {
  const addressesPath = path.join(app.getPath('userData'), 'hsd_data', 'wallet', `${walletId}-${net}`);
  return await fs.promises.writeFile(addressesPath, Buffer.from(addresses.join('\n'), 'utf-8'));
}

export async function deleteAddresses(net = 'main', walletId) {
  const addressesPath = path.join(app.getPath('userData'), 'hsd_data', 'wallet', `${walletId}-${net}`);
  return await fs.promises.unlink(addressesPath);
}

export async function getAddresses(net = 'main', walletId) {
  try {
    const addressesPath = path.join(app.getPath('userData'), 'hsd_data', 'wallet', `${walletId}-${net}`);
    const buf =  await fs.promises.readFile(addressesPath);

    if (!buf) return null;

    const addresses = buf.toString('utf-8').split('\n');

    if (addresses.length !== 20000) return null;

    return addresses;
  } catch (e) {
    return null;
  }
}

function ensureDB() {
  if (!db) {
    throw new Error('db not open');
  }

  if (!nameDB) {
    throw new Error('nameDB not open');
  }

  if (!headerDB) {
    throw new Error('headerDB not open');
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
  addHeader,
  getHeader,
  setAddresses,
  getAddresses,
  deleteAddresses,
};

export async function start(server) {
  await open();
  server.withService(sName, methods);
}

