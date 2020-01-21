require('./sentry');

import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import Root from './pages/Root';
import { history, store } from './store/configureStore';
import './global.scss';
import { monitor } from './ducks/backgroundMonitor';
import { showError } from './ducks/notifications';

window.addEventListener('error', (e) => {
  store.dispatch(showError(e.message));
});

monitor.start();

render(
  <AppContainer>
    <Root store={store} history={history} />
  </AppContainer>,
  document.getElementById('root'),
);
