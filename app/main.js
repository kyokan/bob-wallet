/* eslint global-require: off */

import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import MenuBuilder from './menu';
import showMainWindow from './mainWindow';

export default class AppUpdater {
  constructor() {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

app.on('ready', async () => {
  showMainWindow();

  const menuBuilder = new MenuBuilder();
  menuBuilder.buildMenu();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();

  // start the IPC server
  try {
    const server = require('./background/ipc/service').start();
    require('./background/logger/service').start(server);
    await require('./background/db/service').start(server);
    await require('./background/node/service').start(server);
  } catch (e) {
    dialog.showMessageBox(null, {
      type: 'error',
      buttons: ['OK'],
      title: 'Couldn\'t Start',
      message: 'An error occurred that prevented Bob from starting. Please quit and try again.',
    }, () => app.quit());
    console.log(e);
  }

  app.on('window-all-closed', () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});
