import {clearDeeplink, setDeeplink} from "./ducks/app";

require('./sentry');

import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import Root from './pages/Root';
import { history, store } from './store/configureStore';
import './global.scss';
import { showError } from './ducks/notifications';
import {ipcRenderer} from "electron";
import { clientStub as aClientStub } from './background/analytics/client';
const analytics = aClientStub(() => require('electron').ipcRenderer);

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

function handleDeeplink(message) {
  const url = new URL(message);
  const state = store.getState();
  const isLocked = state.wallet.isLocked;
  const params = url.searchParams;

  analytics.track('deeplink', {
    pathname: url.pathname,
  });

  let name;
  switch (url.pathname) {
    case "//openauction":
      name = params.get('name');

      if (isLocked) {
        store.dispatch(setDeeplink(message));
      } else {
        history.push(`/domain/${name}`);
      }
      return;
    case "//opendomain":
      name = params.get('name');

      if (isLocked) {
        store.dispatch(setDeeplink(message));
      } else if (name) {
        history.push(`/domain_manager/${name}`);
      }
      return;
    default:
      return;
  }
}

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
