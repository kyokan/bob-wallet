import { clientStub } from '../background/db';
const dbClient = clientStub(() => require('electron').ipcRenderer);

export const getWatchlist = async (network) => {
  const data = await dbClient.get(prefixWatchlist(network));
  return data;
}

export const saveToWatchlist = async (network, newList) => {
   return dbClient.put(prefixWatchlist(network), newList);
}

const prefixWatchlist = (network) => {
  return `watchlist:${network}`
}