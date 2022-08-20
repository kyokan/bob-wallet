import "isomorphic-fetch";

// if (process.platform === 'win32') {
  //process.env.NODE_BACKEND = 'js';
// }

require('./sentry');

import {app, dialog} from 'electron';
import MenuBuilder from './menu';
import showMainWindow, {dispatchToMainWindow, sendDeeplinkToMainWindow} from './mainWindow';
import path from 'path';
import {encrypt} from "./utils/encrypt";

const Sentry = require('@sentry/electron/main');

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

if (process.env.NODE_ENV === 'development' && (process.platform === 'win32' || process.platform === 'linux')) {
  app.setAsDefaultProtocolClient('bob', process.execPath, [
    path.resolve(path.join(app.getAppPath(), 'dist', 'main.js')),
  ]);
} else if (process.platform === 'win32' || process.platform === 'linux') {
  app.setAsDefaultProtocolClient('bob', process.execPath, [
    path.resolve(path.join(app.getAppPath(), 'main.js')),
  ]);
} else {
  app.setAsDefaultProtocolClient('bob');
}

// Deeplink handler for osx
app.on('open-url', function (event, url) {
  event.preventDefault();
  sendDeeplinkToMainWindow(url);
});

// Deeplink handler for win
// https://stackoverflow.com/questions/38458857/electron-url-scheme-open-url-event
let deeplinkingUrl;
const isPrimaryInstance = app.requestSingleInstanceLock();

if (isPrimaryInstance) {
  app.on('second-instance', (e, argv) => {
    // Someone tried to run a second instance, we should focus our window.
    showMainWindow();

    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    if (process.platform === 'win32' || process.platform === 'linux') {
      // Keep only command line / deep linked arguments
      deeplinkingUrl = argv[argv.length - 1];
    }

    sendDeeplinkToMainWindow(deeplinkingUrl);
  });

  app.on('ready', async () => {
    // start the IPC server
    const dbService = require('./background/db/service');
    const shakedexService = require('./background/shakedex/service.js');
    try {
      const server = require('./background/ipc/service').start();
      require('./background/logger/service').start(server);
      await dbService.start(server);
      await require('./background/node/service').start(server);
      await require('./background/wallet/service').start(server);
      await require('./background/analytics/service').start(server);
      await require('./background/connections/service').start(server);
      await require('./background/setting/service').start(server);
      await require('./background/hip2/service').start(server);
      await require('./background/claim/service').start(server);
      await require('./background/ledger/service').start(server);

      await shakedexService.start(server);
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

      shakedexService.closeDB()
        .catch((e) => console.error('Error in shutdown:', e))
        .then(dbService.close)
        .catch((e) => console.error('Error in shutdown:', e))
        .then(() => app.quit());
    }

    app.on('before-quit', quit);

    showMainWindow();

    const menuBuilder = new MenuBuilder();
    menuBuilder.buildMenu();
  });
} else {
  app.quit();
}
