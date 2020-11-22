import "isomorphic-fetch";

if (process.platform === 'win32') {
  //process.env.NODE_BACKEND = 'js';
}

require('./sentry');

import {app, dialog} from 'electron';
import MenuBuilder from './menu';
import showMainWindow, {dispatchToMainWindow, sendDeeplinkToMainWindow} from './mainWindow';

const Sentry = require('@sentry/electron');

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

app.setAsDefaultProtocolClient('bob');

// Protocol handler for osx
app.on('open-url', function (event, url) {
  event.preventDefault();
  sendDeeplinkToMainWindow(url);
});

app.on('ready', async () => {
  // start the IPC server
  const dbService = require('./background/db/service');
  try {
    const server = require('./background/ipc/service').start();
    require('./background/logger/service').start(server);
    await dbService.start(server);
    await require('./background/node/service').start(server);
    await require('./background/wallet/service').start(server);
    await require('./background/analytics/service').start(server);
    await require('./background/connections/service').start(server);
    await require('./background/setting/service').start(server);
  } catch (e) {
    dialog.showMessageBox(null, {
      type: 'error',
      buttons: ['OK'],
      title: 'Couldn\'t Start',
      message: 'An error occurred that prevented Bob from starting. Please quit and try again.',
      detail: `Error: ${e.message}\nStack: ${e.stack}`,
    }, () => app.quit());
    Sentry.captureException(e);
    return;
  }

  app.on('window-all-closed', () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  let didFireQuitHandlers = false;

  function quit(event) {
    if (didFireQuitHandlers) {
      return;
    }
    event.preventDefault();
    didFireQuitHandlers = true;
    dbService.close()
      .catch((e) => console.error('Error in shutdown:', e))
      .then(() => app.quit());
  }

  app.on('before-quit', quit);

  showMainWindow();

  const menuBuilder = new MenuBuilder();
  menuBuilder.buildMenu();
});
