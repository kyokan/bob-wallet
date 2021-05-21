import { clientStub } from '../background/db/client';
import { NETWORKS, VALID_NETWORKS } from '../constants/networks';
const dbClient = clientStub(() => require('electron').ipcRenderer);

export async function getNetwork() {
  return (await dbClient.get(networkKey())) || NETWORKS.MAINNET;
}

export async function setNetwork(network) {
  if (!VALID_NETWORKS[network]) {
    throw new Error('invalid network');
  }

  return dbClient.put(networkKey(), network);
}

export async function getInitializationState(network) {
  const initState = await dbClient.get(initializationStateKey(network));
  return initState === '1' || initState === '"1"';
}

export async function setInitializationState(network, state) {
  return dbClient.put(initializationStateKey(network), state ? '1' : '0');
}

export async function getWalletPassHash(wid) {
  return dbClient.get(walletPassHashKey(wid)) || '';
}

export async function setWalletPassHash(wid, hash) {
  return dbClient.put(walletPassHashKey(wid), hash);
}

export async function deleteWalletPassHash(wid) {
  return dbClient.del(walletPassHashKey(wid));
}

function initializationStateKey(network) {
  return `initialization-state:${network || 'main'}`;
}

function networkKey() {
  return 'network';
}

function walletPassHashKey(wid) {
  return `wallet-passhash:${wid}`;
}