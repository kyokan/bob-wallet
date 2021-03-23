import { makeClient } from '../ipc/ipc.js';

export const clientStub = ipcRendererInjector => makeClient(ipcRendererInjector, 'Shakedex', [
  'fulfillSwap',
  'getFulfillments',
  'finalizeSwap',
  'transferLock',
  'transferCancel',
  'getListings',
  'finalizeLock',
  'finalizeCancel',
  'launchAuction',
  'downloadProofs',
  'restoreOneListing',
  'restoreOneFill',
  'getExchangeAuctions',
  'listAuction',
]);
