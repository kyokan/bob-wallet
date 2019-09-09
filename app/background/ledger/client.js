import { makeClient } from '../ipc/ipc';

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, 'Ledger', [
  'getXPub',
  'signTransaction'
]);
