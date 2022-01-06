import React, { Component } from 'react';
import {connect, Provider} from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';
import App from './App';
import translations, {I18nContext} from "../utils/i18n";

export default class Root extends Component {

  render() {
    // eslint-disable-next-line react/prop-types
    const { store, history } = this.props;

    return (
      <Provider store={store}>
        <Content history={history} />
      </Provider>
    );
  }
}

@connect(
  (state) => ({
    locale: state.app.locale,
  }),
)
class Content extends Component {
  render() {
    const locale = this.props.locale;
    const rootLocale = locale.split('-')[0];

    const localeT = translations[locale] || {};
    const rootT = translations[rootLocale] || {};

    return (
      <I18nContext.Provider
        value={{
          t: key => {
            return localeT[key] || rootT[key] || translations.en[key] || `this.context.t(${key})`;
          }
        }}
      >
        <ConnectedRouter history={this.props.history}>
          <App />
        </ConnectedRouter>
      </I18nContext.Provider>
    );
  }
}
