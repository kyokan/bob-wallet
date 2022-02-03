const Sentry = (
  process.type === 'renderer'
  ? require('@sentry/electron/renderer')
  : require('@sentry/electron/main')
);

const electron = require('electron');
const pkg = require('../package.json');

(function () {
  // Will not initialize in renderer process, for now
  if (!electron.app || !electron.app.isPackaged) {
    return;
  }
  Sentry.init({
    dsn: 'https://ea41895688674e598d69cbd975872db8@sentry.io/1759225',
    release: 'bob-wallet@' + pkg.version,
  });
})();
