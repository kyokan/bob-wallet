const Sentry = require('@sentry/electron');
const electron = require('electron');
const pkg = require('../package.json');

(function () {
  if (!(electron.app || electron.remote.app).isPackaged) {
    return;
  }
  Sentry.init({
    dsn: 'https://ea41895688674e598d69cbd975872db8@sentry.io/1759225',
    release: 'bob-wallet@' + pkg.version,
  });
})();
