import {clearDeeplink, setDeeplink, setDeeplinkParams} from "./ducks/app";

require('./sentry');

import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import Root from './pages/Root';
import { history, store } from './store/configureStore';
import { showError } from './ducks/notifications';
import {ipcRenderer} from "electron";
import handleDeeplink from './deeplink';
import './global.scss';

window.addEventListener('error', (e) => {
  store.dispatch(showError(e.message));
});

ipcRenderer.on('ipcToRedux', (_, message) => {
  if (message && message.type) {
    store.dispatch(message);
  }
});

ipcRenderer.on('deeplink', (_, message) => {
  handleDeeplink(message);
});

history.listen(location => {
  const state = store.getState();
  const deeplink = state.app.deeplink;
  if (deeplink) {
    store.dispatch(clearDeeplink());
    handleDeeplink(deeplink);
    throw new Error('route change disallowed -- this error is intentional');
  }
});

render(
  <AppContainer>
    <Root store={store} history={history} />
  </AppContainer>,
  document.getElementById('root'),
);
