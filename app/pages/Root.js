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
    customLocale: state.app.customLocale,
  }),
)
class Content extends Component {
  translate = (key, ...values) => {
    try {
      const locale = this.props.locale;
      const customLocale = this.props.customLocale || {};
      const rootLocale = locale.split('-')[0];

      const localeT = locale === 'custom' ? customLocale : (translations[locale] || {});
      const rootT = translations[rootLocale] || {};

      const str = localeT[key] || rootT[key] || translations.en[key] || `this.context.t(${key})`;
      let result = str;

      for (let val of values) {
        result = result.replace('%s', val);
      }

      return result;
    } catch (e) {
      return `this.context.t(${key})`;
    }
  };

  render() {
    return (
      <I18nContext.Provider
        value={{
          t: this.translate,
        }}
      >
        <ConnectedRouter history={this.props.history}>
          <App />
        </ConnectedRouter>
      </I18nContext.Provider>
    );
  }
}
