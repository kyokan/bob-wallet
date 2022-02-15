import { clientStub } from '../background/db/client';
import { hashName } from 'hsd/lib/covenants/rules';
const dbClient = clientStub(() => require('electron').ipcRenderer);


export async function storeName(name) {
  const hash = hashName(name).toString('hex');
  if (await findNameByHash(hash)) {
    return;
  }
  await dbClient.put(prefixName(name), hash);
  await dbClient.put(prefixHash(hash), name);
}

export async function findNameByHash(hash) {
  return dbClient.get(prefixHash(hash));
}

export function prefixName(name) {
  return `names:${name}`
}

export function prefixHash(hash) {
  return `namehashes:${hash}`
}
