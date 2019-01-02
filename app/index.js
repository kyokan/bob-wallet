import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import Root from './pages/Root';
import { history, store } from './store/configureStore';
import './global.scss';
import * as node from './ducks/node';
import { NETWORKS } from './background/node';

store.dispatch(node.start(NETWORKS.SIMNET));

render(
  <AppContainer>
    <Root store={store} history={history} />
  </AppContainer>,
  document.getElementById('root')
);

if (module.hot) {
  module.hot.accept('./pages/Root', () => {
    // eslint-disable-next-line global-require
    const NextRoot = require('./pages/Root').default;
    render(
      <AppContainer>
        <NextRoot store={store} history={history} />
      </AppContainer>,
      document.getElementById('root')
    );
  });
}
