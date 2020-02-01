import isDev from './utils/isDev';

const Sentry = require('@sentry/electron');

(function () {
  if (!isDev()) {
    Sentry.init({
      dsn: 'https://ea41895688674e598d69cbd975872db8@sentry.io/1759225',
    });
  }
})();
