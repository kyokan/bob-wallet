require('./sentry');

import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import Root from './pages/Root';
import { history, store } from './store/configureStore';
import './global.scss';
import { showError } from './ducks/notifications';
import {ipcRenderer} from "electron";

window.addEventListener('error', (e) => {
  store.dispatch(showError(e.message));
});

ipcRenderer.on('ipcToRedux', (_, message) => {
  if (message && message.type) {
    store.dispatch(message);
  }
});

render(
  <AppContainer>
    <Root store={store} history={history} />
  </AppContainer>,
  document.getElementById('root'),
);
