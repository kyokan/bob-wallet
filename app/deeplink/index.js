import { setDeeplink } from '../ducks/app';
import { clientStub as aClientStub } from '../background/analytics/client';
const analytics = aClientStub(() => require('electron').ipcRenderer);
import { store } from '../store/configureStore';
import * as methods from './methods';

export default function handleDeeplink(message) {
  const url = new URL(message);
  const state = store.getState();
  const isLocked = state.wallet.isLocked;

  analytics.track('deeplink', {
    pathname: url.pathname,
  });

  // pathname = "//method/"
  const [method] = url.pathname.substr(2).split('/');
  const handler = methods[method];

  if (typeof handler === 'function') {
    if (isLocked) {
      store.dispatch(setDeeplink(message));
      return;
    }

    methods[method](message);
  } else {
    console.error('Unknown deeplink:', message);
  }
}
