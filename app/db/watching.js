import { clientStub } from '../background/db/client';

const dbClient = clientStub(() => require('electron').ipcRenderer);

export const getWatchlist = async (network) => {
  return dbClient.get(prefixWatchlist(network));
};

export const saveToWatchlist = async (network, newList) => {
  return dbClient.put(prefixWatchlist(network), newList);
};

const prefixWatchlist = (network) => {
  return `watchlist:${network}`
};
