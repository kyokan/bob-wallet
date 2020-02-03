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
  return (await dbClient.get(initializationStateKey(network))) === '1';
}

export async function setInitializationState(network, state) {
  return dbClient.put(initializationStateKey(network), state ? '1' : '0');
}

function initializationStateKey(network) {
  return `initialization-state:${network}`;
}

function networkKey() {
  return 'network';
}
