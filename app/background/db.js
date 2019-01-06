import { app } from 'electron';
import { defaultServer, makeClient } from './ipc';
import level from 'level';
const path = require('path');

let db;

export async function open() {
  if (db) {
    return;
  }

  const loc = path.join(app.getPath('userData'), 'db');
  return new Promise((resolve, reject) => level(loc, (err, newDb) => {
    if (err) {
      return reject(err);
    }

    db = newDb;
    resolve();
  }));
}

export async function close() {
  if (!db) {
    return;
  }

  await db.close();
  db = null;
}

export async function put(key, value) {
  ensureDB();
  return db.put(key, JSON.stringify(value));
}

export async function get(key) {
  try {
    const data = await db.get(key);
    return JSON.parse(data);
  } catch (e) {
    if (e instanceof level.errors.NotFoundError) {
      return null;
    }

    throw e;
  }
}

export async function del(key) {
  return db.del(key);
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
  del
};

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, sName, Object.keys(methods));
defaultServer.withService(sName, methods);
