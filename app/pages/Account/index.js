import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Transactions from '../../components/Transactions';
import './account.scss';
import { displayBalance } from '../../utils/balances';
import Tooltipable from '../../components/Tooltipable';
import { clientStub as aClientStub } from '../../background/analytics/client';

const pkg = require('../../../package.json');

const analytics = aClientStub(() => require('electron').ipcRenderer);

@connect(
  (state) => ({
    unconfirmedBalance: state.wallet.balance.unconfirmed,
    spendableBalance: state.wallet.balance.spendable,
    height: state.node.chain.height,
  }),
)
export default class Account extends Component {
  static propTypes = {
    unconfirmedBalance: PropTypes.number.isRequired,
    spendableBalance: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  };

  componentDidMount() {
    analytics.screenView('Account');
  }

  render() {
    const {unconfirmedBalance, spendableBalance} = this.props;

    return (
      <div className="account">
        {this.maybeRenderTXAlert()}
        <div className="account__header">
          <div className="account__header-section">
            <div className="account__address">
              <div>Total Balance</div>
            </div>
            <div className="account__balance-wrapper">
              <div className="account__balance-wrapper__amount">{`HNS ${displayBalance(unconfirmedBalance)}`}</div>
            </div>
          </div>
          <div className="account__header-section">
            <div className="account__address">
              <div>Spendable Balance</div>
              <Tooltipable
                tooltipContent="Spendable balance represents all coins in the wallet (both confirmed and unconfirmed) that are not locked by auction bids or registered names.">
                <div className="account__info-icon" />
              </Tooltipable>
            </div>
            <div className="account__balance-wrapper">
              <div className="account__balance-wrapper__amount">{`HNS ${displayBalance(spendableBalance)}`}</div>
            </div>
          </div>
        </div>
        <div className="account__transactions">
          <div className="account__panel-title">Transaction History</div>
          <Transactions />
        </div>
      </div>
    );
  }

  maybeRenderTXAlert() {
    if (this.props.height > 2016) {
      return null;
    }

    return (
      <div className="account__alert">
        <strong>Important:</strong> Transactions are disabled for the first two weeks of mainnet.
      </div>
    );
  }
}
