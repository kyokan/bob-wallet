import path from 'path';
import { BrowserWindow, app } from 'electron';

let mainWindow;

export default function showMainWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;

    // need to quit the entire app (i.e., including
    // the HSD window) once the main window is closed
    // on Windows
    if (process.platform === 'win32') {
      app.quit();
    }
  });
}

export function getMainWindow() {
  return mainWindow;
}

export function dispatchToMainWindow(reduxAction) {
  mainWindow.webContents.send('ipcToRedux', reduxAction);
}

export function sendDeeplinkToMainWindow(url) {
  mainWindow.webContents.send('deeplink', url);
}
