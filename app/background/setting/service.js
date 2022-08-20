import { del, get, put } from '../db/service';
import { app } from "electron";

const EXPLORER = 'setting/explorer';
const LOCALE = 'setting/locale';
const CUSTOM_LOCALE = 'setting/customLocale';


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

export async function getCustomLocale() {
  return await get(CUSTOM_LOCALE);
}

export async function setLocale(locale) {
  await put(CUSTOM_LOCALE, '');
  return await put(LOCALE, locale);
}

export async function setCustomLocale(json) {
  await put(LOCALE, 'custom');
  return await put(CUSTOM_LOCALE, JSON.stringify(json));
}

export async function getLatestRelease() {
  try {
    const releases = await (
      await fetch(
        'https://api.github.com/repos/kyokan/bob-wallet/releases'
      )
    ).json();
    const latest = releases.filter(r => !r.draft && !r.prerelease)[0];
    return latest;
  } catch (error) {
    console.error(error);
    return null;
  }
}

const sName = 'Setting';
const methods = {
  getExplorer,
  setExplorer,
  getLocale,
  setLocale,
  getCustomLocale,
  setCustomLocale,
  getLatestRelease,
};

export async function start(server) {
  server.withService(sName, methods);
}
