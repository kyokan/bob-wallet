import { clientStub } from '../background/db/client';
import { NETWORKS, VALID_NETWORKS } from '../constants/networks';
const dbClient = clientStub(() => require('electron').ipcRenderer);

export async function getUnlockReceiveAddress(network) {
  return dbClient.get(unlockReceiveAddressKey(network));
}

export async function setUnlockReceiveAddress(network, addr) {
  return dbClient.put(unlockReceiveAddressKey(network), addr);
}

export async function delUnlockReceiveAddress(network) {
  return dbClient.del(unlockReceiveAddressKey(network));
}

export async function getNetwork() {
  return (await dbClient.get(networkKey())) || NETWORKS.REGTEST;
}

export async function setNetwork(network) {
  if (!VALID_NETWORKS[network]) {
    throw new Error('invalid network');
  }

  return dbClient.put(networkKey(), network);
}

export async function getInitializationState(network) {
  return (await dbClient.get(initializationStateKey(network))) === '1';
}

export async function setInitializationState(network, state) {
  return dbClient.put(initializationStateKey(network), state ? '1' : '0');
}

function unlockReceiveAddressKey(network) {
  return `unlock-receive-address:${network}`;
}

function initializationStateKey(network) {
  return `initialization-state:${network}`;
}

function networkKey() {
  return 'network';
}
