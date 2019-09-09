import { makeClient } from '../ipc/ipc';

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, 'DB', [
  'open',
  'close',
  'put',
  'get',
  'del',
]);
