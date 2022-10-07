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

/** @deprecated */
export async function getInitializationState(network) {
  const initState = await dbClient.get(initializationStateKey(network));
  return initState === '1' || initState === '"1"';
}

/** @deprecated */
export async function setInitializationState(network, state) {
  return dbClient.put(initializationStateKey(network), state ? '1' : '0');
}

export async function getMaxIdleMinutes() {
  const maxIdle = await dbClient.get('max-idle');
  if (maxIdle === null) {
    return null;
  }
  return (maxIdle >>> 0);
}

export async function setMaxIdleMinutes(maxIdle) {
  return dbClient.put('max-idle', maxIdle >>> 0);
}

/** @deprecated */
function initializationStateKey(network) {
  return `initialization-state:${network || 'main'}`;
}

function networkKey() {
  return 'network';
}
