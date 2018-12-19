import React from 'react';
import classNames from 'classnames';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';

import ConnectLedgerStep from './ConnectLedgerStep';
import './connect.scss';

// wizard header

@withRouter
export default class ConnectLedger extends React.Component {
  static propTypes = {
    onBack: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
  };

  state = {
    isLedgerConnected: true,
    secretEntered: true,
    handshakeSelected: true,
  };

  allStepsComplete() {
    const { isLedgerConnected, secretEntered, handshakeSelected } = this.state;
    return isLedgerConnected && secretEntered && handshakeSelected;
  }

  finishFlow() {
    if (this.allStepsComplete()) {
      return console.log('DONEEEEZO');
    }
    return console.log('Not donezo :(');
  }

  render() {
    const { isLedgerConnected, secretEntered, handshakeSelected } = this.state;

    const { onBack, onCancel } = this.props;
    return (
      <div className="create-password">
        <div className="terms__header">
          <i
            className="arrow left clickable wizard-header__back"
            onClick={onBack}
          />
          <span className="wizard-header__cancel" onClick={onCancel}>
            Cancel
          </span>
        </div>
        <div className="create-password__content">
          <div className="header_text">Connect your Ledger</div>
          <ConnectLedgerStep
            stepNumber={1}
            stepDescription={'Connect your Ledger directly to your computer'}
            stepCompleted={isLedgerConnected}
          />
          <ConnectLedgerStep
            stepNumber={2}
            stepDescription={'Enter your secret pin on your Ledger device'}
            stepCompleted={secretEntered}
          />
          <ConnectLedgerStep
            stepNumber={3}
            stepDescription={'Select the Handshake app on your Ledger'}
            stepCompleted={handshakeSelected}
          />
        </div>
        <div
          className={classNames([
            'create-password__footer',
            'create-password__footer__removed-padding-top',
          ])}
        >
          <div className="connect__support-cta">
            Need help? Visit support page
          </div>
          <button
            className="extension_cta_button terms_cta"
            onClick={this.finishFlow()}
            disabled={!this.allStepsComplete()}
          >
            Unlock Ledger
          </button>
        </div>
      </div>
    );
  }
}
