import { makeClient } from '../ipc/ipc';

export const clientStub = ipcRendererInjector => makeClient(ipcRendererInjector, 'Hip2', [
  'getPort',
  'setPort',
  'fetchAddress',
  'setServers',
]);
