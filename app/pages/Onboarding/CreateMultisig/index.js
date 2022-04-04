import React from 'react';
import classNames from 'classnames';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { clientStub as lClientStub } from '../../../background/ledger/client';
import walletClient from '../../../utils/walletClient';
import { connect } from 'react-redux';
import * as walletActions from '../../../ducks/walletActions';


@withRouter
@connect((state) => ({
  network: state.wallet.network,
}), (dispatch) => ({
  completeInitialization: (name, passphrase) => dispatch(
    walletActions.completeInitialization(name, passphrase)
  ),
}))
export default class CreateMultisig extends React.Component {
  static propTypes = {
    walletName: PropTypes.string.isRequired,
    passphrase: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    completeInitialization: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
  };

  state = {
    errorMessage: null,
    m: 2,
    n: 2
  };

  render() {
    const {
      walletName,
      passphrase,
      onBack,
      onCancel,
      completeInitialization,
      network
    } = this.props;

    return (
      <div>
        Total number of participants:
        <input
          type="number"
          min={2}
          max={30}
          value={this.state.n}
          pattern="\d+"
          onChange={e => this.setState({n: e.target.value})}
        />
        Required signatures per transaction:
        <input
          type="number"
          min={this.state.n}
          value={this.state.m}
          pattern="\d+"
          onChange={e => this.setState({m: e.target.value})}
        />
        <button
          onClick={async () => {
            await walletClient.createNewWallet(
              walletName,
              passphrase,
              false, // isLedger
              null,  // xpub (Ledger only)
              parseInt(this.state.m),
              parseInt(this.state.n)
            );
            await this.props.completeInitialization(
              this.props.walletName,
              this.props.passphrase
            );
            this.props.history.push('/multisig');
          }}
        >
          Create Multisig Wallet
        </button>
      </div>
    );
  }
}
