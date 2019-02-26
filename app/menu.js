import { app, Menu, shell } from 'electron';
import { getMainWindow } from './mainWindow';
import showMainWindow from './mainWindow';

export default class MenuBuilder {
  buildMenu() {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

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
    mainWin.openDevTools();
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
          selector: 'orderFrontStandardAboutPanel:'
        },
        {type: 'separator'},
        {label: 'Services', submenu: []},
        {type: 'separator'},
        {
          label: 'Hide Bob',
          accelerator: 'Command+H',
          selector: 'hide:'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:'
        },
        {label: 'Show All', selector: 'unhideAllApplications:'},
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
        {label: 'Undo', accelerator: 'Command+Z', selector: 'undo:'},
        {label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:'},
        {type: 'separator'},
        {label: 'Cut', accelerator: 'Command+X', selector: 'cut:'},
        {label: 'Copy', accelerator: 'Command+C', selector: 'copy:'},
        {label: 'Paste', accelerator: 'Command+V', selector: 'paste:'},
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:'
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
          selector: 'performMiniaturize:'
        },
        {label: 'Close', accelerator: 'Command+W', selector: 'performClose:'},
        {type: 'separator'},
        {label: 'Bring All to Front', selector: 'arrangeInFront:'}
      ]
    };
    const subMenuHelp = {
      label: 'Help',
      submenu: [
        {
          label: 'Report an Issue',
          click() {
            shell.openExternal('https://github.com/kyokan/onoma-electron/issues/new');
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
              shell.openExternal("https://github.com/kyokan/onoma-electron")
            }
          },
          {
            label: 'Report an Issue',
            click() {
              shell.openExternal('https://github.com/kyokan/onoma-electron/issues/new');
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
