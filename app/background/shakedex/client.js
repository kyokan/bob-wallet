import { makeClient } from '../ipc/ipc.js';

export const clientStub = ipcRendererInjector => makeClient(ipcRendererInjector, 'Shakedex', [
  'fulfillSwap',
  'getFulfillments',
  'finalizeSwap',
  'transferLock',
  'getListings',
  'finalizeLock',
  'launchAuction'
]);
