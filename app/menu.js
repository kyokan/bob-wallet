import { app, Menu, shell } from 'electron';
import showMainWindow, { getMainWindow } from './mainWindow';
const pkg = require('../package.json');
const Path = require('path');

export default class MenuBuilder {
  buildMenu() {

    // https://www.electronjs.org/docs/all#appsetaboutpaneloptionsoptions
    // version: MacOS only
    // credits: MacOS & Windows only
    // authors: Linux only
    // website: Linux only
    // iconPath: Linux & Windows only
    app.setAboutPanelOptions({
      applicationName: pkg.productName, 
      applicationVersion: pkg.version,
      copyright: `License: ${pkg.license}`,
      version: pkg.version,
      credits: pkg.author,
      author: pkg.author,
      website: pkg.homepage,
      iconPath: Path.join(process.resourcesPath, 'icons/128x128.png')
    });

    this.setupDevelopmentEnvironment();

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment() {
    const mainWin = getMainWindow();
    mainWin.webContents.on('context-menu', (e, props) => {
      const {x, y} = props;
      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            mainWin.inspectElement(x, y);
          }
        }
      ]).popup(mainWin);
    });
  }

  buildDarwinTemplate() {
    const mainWin = getMainWindow();

    const subMenuAbout = {
      label: 'Bob',
      submenu: [
        {
          label: 'About Bob',
          role: 'about'
        },
        {type: 'separator'},
        {label: 'Services', submenu: []},
        {type: 'separator'},
        {
          label: 'Hide Bob',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideOthers'
        },
        {label: 'Show All', role: 'unhide'},
        {type: 'separator'},
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    };
    const subMenuEdit = {
      label: 'Edit',
      submenu: [
        {label: 'Undo', accelerator: 'Command+Z', role: 'undo'},
        {label: 'Redo', accelerator: 'Shift+Command+Z', role: 'redo'},
        {type: 'separator'},
        {label: 'Cut', accelerator: 'Command+X', role: 'cut'},
        {label: 'Copy', accelerator: 'Command+C', role: 'copy'},
        {label: 'Paste', accelerator: 'Command+V', role: 'paste'},
        {
          label: 'Select All',
          accelerator: 'Command+A',
          role: 'selectAll'
        }
      ]
    };
    const subMenuViewDev = {
      label: 'View',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'Command+N',
          click: showMainWindow,
        },
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: this.withMain((m) => m.webContents.reload())
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: this.withMain((m) => m.setFullScreen(!mainWin.isFullScreen()))
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: this.withMain((m) => m.toggleDevTools()),
        }
      ]
    };
    const subMenuViewProd = {
      label: 'View',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'Command+N',
          click: showMainWindow,
        },
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: this.withMain((m) => m.webContents.reload())
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: this.withMain((m) => m.setFullScreen(!m.isFullScreen()))
        }
      ]
    };
    const subMenuWindow = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          role: 'minimize'
        },
        {label: 'Close', accelerator: 'Command+W', role: 'close'},
        {type: 'separator'},
        {label: 'Bring All to Front', role: 'front'}
      ]
    };
    const subMenuHelp = {
      label: 'Help',
      submenu: [
        {
          label: 'Report an Issue',
          click() {
            shell.openExternal('https://forum.kyokan.io/c/bob/support/5');
          }
        }
      ]
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ? subMenuViewDev : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  buildDefaultTemplate() {
    const mainWin = getMainWindow();

    const templateDefault = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              mainWin.close();
            }
          }
        ]
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development'
            ? [
              {
                label: '&Reload',
                accelerator: 'Ctrl+R',
                click: () => {
                  mainWin.webContents.reload();
                }
              },
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click: () => {
                  mainWin.setFullScreen(
                    !mainWin.isFullScreen()
                  );
                }
              },
              {
                label: 'Toggle &Developer Tools',
                accelerator: 'Alt+Ctrl+I',
                click: () => {
                  mainWin.toggleDevTools();
                }
              }
            ]
            : [
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click: () => {
                  mainWin.setFullScreen(
                    !mainWin.isFullScreen()
                  );
                }
              }
            ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: "About Bob",
            click: () => {
              shell.openExternal("https://github.com/kyokan/bob-electron")
            }
          },
          {
            label: 'Report an Issue',
            click() {
              shell.openExternal('https://forum.kyokan.io/c/bob/support/5');
            }
          }
        ]
      }
    ];

    return templateDefault;
  }

  withMain(cb) {
    return () => {
      const mainWin = getMainWindow();
      if (!mainWin) {
        return;
      }

      cb(mainWin);
    }
  }
}
