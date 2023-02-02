import { clientStub } from '../background/db/client';
const dbClient = clientStub(() => require('electron').ipcRenderer);


const prefix = (network) => {
  return `wallet:${network}`;
};

const multisigKeyNamePrefix = (network, wid, key) => {
  return `${prefix(network)}:multisig-key-name:${wid}:${key}`;
};


export const getMultisigKeyName = async (network, wid, accountKey) => {
  return dbClient.get(multisigKeyNamePrefix(network, wid, accountKey));
};

export const setMultisigKeyName = async (network, wid, accountKey, name) => {
  return dbClient.put(multisigKeyNamePrefix(network, wid, accountKey), name);
};

export const delMultisigKeyName = async (network, wid, accountKey) => {
  return dbClient.del(multisigKeyNamePrefix(network, wid, accountKey));
};
