import { del, get, put } from '../db/service';

const EXPLORER = 'setting/explorer';


export async function getExplorer() {
  const explorer = await get(EXPLORER);
  return explorer;
}

export async function setExplorer(explorer) {
  return await put(EXPLORER, explorer);
}

const sName = 'Setting';
const methods = {
  getExplorer,
  setExplorer,
};

export async function start(server) {
  server.withService(sName, methods);
}
