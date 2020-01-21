import { makeClient } from '../ipc/ipc';

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, 'Analytics', [
  'setOptIn',
  'getOptIn',
  'track',
  'screenView',
]);
