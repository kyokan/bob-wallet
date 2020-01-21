const Sentry = require('@sentry/electron');

(function () {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: 'https://ea41895688674e598d69cbd975872db8@sentry.io/1759225',
    });
  }
})();
