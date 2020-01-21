import { makeClient } from '../ipc/ipc';

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, 'Logger', [
  'info',
  'warn',
  'error',
  'log',
  'download'
]);
