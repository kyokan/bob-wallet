import { makeClient } from '../ipc/ipc';

export const clientStub = ipcRendererInjector => makeClient(ipcRendererInjector, 'Node', [
  'start',
  'stop',
  'reset',
]);
