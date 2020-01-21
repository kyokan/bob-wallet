import React from 'react';
import classNames from 'classnames';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { clientStub as lClientStub } from '../../../background/ledger/client';
import walletClient from '../../../utils/walletClient';
import { connect } from 'react-redux';
import * as walletActions from '../../../ducks/walletActions';
import DefaultConnectLedgerSteps from '../../../components/ConnectLedgerStep/defaultSteps';
import './connect.scss';

const ledgerClient = lClientStub(() => require('electron').ipcRenderer);

// wizard header

@withRouter
@connect((state) => ({
  network: state.node.network,
}), (dispatch) => ({
  completeInitialization: (xpub) => dispatch(walletActions.completeInitialization(xpub, true)),
}))
class ConnectLedger extends React.Component {
  static propTypes = {
    onBack: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    completeInitialization: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
  };

  state = {
    isLoading: false,
    isCreating: false,
  };

  allStepsComplete() {
    const {isLedgerConnected, secretEntered, handshakeSelected} = this.state;
    return isLedgerConnected && secretEntered && handshakeSelected;
  }

  connect = async () => {
    this.setState({
      isLoading: true,
    });

    let xpub;

    try {
      xpub = await ledgerClient.getXPub(this.props.network);
    } catch (e) {
      console.error(e);
      this.setState({
        isLoading: false,
        isCreating: false,
      });
      return;
    }

    this.setState({
      isCreating: true,
    });

    // set a small timeout to clearly show that this is
    // a two-phase process.
    setTimeout(async () => {
      await walletClient.createNewWallet(xpub, true);
      await this.props.completeInitialization('');
    }, 2000);
  };

  render() {
    const {isCreating} = this.state;

    const {onBack, onCancel} = this.props;
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
          <DefaultConnectLedgerSteps completedSteps={[isCreating, isCreating, isCreating]} />
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
            type="button"
            className="extension_cta_button terms_cta"
            onClick={this.connect}
            disabled={this.state.isLoading}
          >
            {this.state.isLoading ? (this.state.isCreating ? 'Creating wallet...' : 'Connecting...') : 'Connect to Ledger'}
          </button>
        </div>
      </div>
    );
  }
}

export default ConnectLedger;
