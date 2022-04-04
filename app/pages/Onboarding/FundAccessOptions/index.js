import React, { Component } from 'react';
import { withRouter, Link } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import './access.scss';
import {I18nContext} from "../../../utils/i18n";

class FundAccessOptions extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func
    }).isRequired
  };

  static contextType = I18nContext;

  render() {
    const {t} = this.context;
    return (
      <div className="extension_primary_section funding-options">
        <div className="funding-options__header">
          <div className="funding-options__header__the-cat" />
        </div>
        <div className="funding-options__content">
          <div className="funding-options__content__title">
            {t('obMainTitle')}
          </div>
          <div className="funding-options__content__body-text">
            {t('obMainBody')}
          </div>
        </div>
        <div className="funding-options__footer">
          <button
            type="button"
            className="funding-options__footer__primary-btn"
            onClick={() => this.props.history.push('/new-wallet/local')}
          >
            {t('obMainCreateText')}
          </button>
          <button
            type="button"
            className="funding-options__footer__secondary-btn"
            onClick={() => this.props.history.push('/existing-options')}
          >
            {t('obMainImportText')}
          </button>
          <button
            type="button"
            className="funding-options__footer__secondary-btn"
            onClick={() => this.props.history.push('/new-wallet/ledger')}
          >
            {t('obMainConnectLedger')}
          </button>
          <button
            type="button"
            className="funding-options__footer__secondary-btn"
            onClick={() => this.props.history.push('/new-wallet/multisig')}
          >
            Multisig
          </button>

          {!!this.props.wallets.length && (
            <Link
              to="/"
              className="login_subheader_text login_subheader_text__accent"
            >
              {t('obMainReturnToLogin')}
            </Link>
          )}
        </div>
      </div>
    );
  }
}

export default withRouter(
  connect(
    state => ({
      wallets: state.wallet.wallets
    }),
    dispatch => ({})
  )(FundAccessOptions)
);
