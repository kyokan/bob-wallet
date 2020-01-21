import { makeServer, nullServer } from './ipc';

export let defaultServer;

export function start() {
  if (!require('electron').ipcMain) {
    defaultServer = nullServer
  } else {
    defaultServer = makeServer(require('electron').ipcMain);
  }

  defaultServer.start();
  return defaultServer;
}
