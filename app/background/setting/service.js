import { del, get, put } from '../db/service';
import { app } from "electron";

const EXPLORER = 'setting/explorer';


export async function getExplorer() {
  const explorer = await get(EXPLORER);
  return explorer;
}

export async function setExplorer(explorer) {
  return await put(EXPLORER, explorer);
}

export async function getLocale() {
  return app.getLocale();
}

const sName = 'Setting';
const methods = {
  getExplorer,
  setExplorer,
  getLocale,
};

export async function start(server) {
  server.withService(sName, methods);
}
