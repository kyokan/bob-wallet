import { makeClient } from '../ipc/ipc';

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, 'Connections', [
  'getConnection',
  'setConnection',
  'setConnectionType',
  'getCustomRPC',
]);
