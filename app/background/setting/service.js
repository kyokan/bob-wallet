import { del, get, put } from '../db/service';
import { app } from "electron";

const EXPLORER = 'setting/explorer';
const LOCALE = 'setting/locale';


export async function getExplorer() {
  const explorer = await get(EXPLORER);
  return explorer;
}

export async function setExplorer(explorer) {
  return await put(EXPLORER, explorer);
}

export async function getLocale() {
  const locale = await get(LOCALE);

  if (locale) return locale;

  return app.getLocale();
}



export async function setLocale(locale) {
  return await put(LOCALE, locale);
}

const sName = 'Setting';
const methods = {
  getExplorer,
  setExplorer,
  getLocale,
  setLocale,
};

export async function start(server) {
  server.withService(sName, methods);
}
