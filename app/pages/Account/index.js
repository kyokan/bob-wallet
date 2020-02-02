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
    confirmedBalance: state.wallet.balance.confirmed,
    unconfirmedBalance: state.wallet.balance.unconfirmed,
  }),
)
export default class Account extends Component {
  static propTypes = {
    confirmedBalance: PropTypes.number.isRequired,
    unconfirmedBalance: PropTypes.number.isRequired,
  };

  componentDidMount() {
    analytics.screenView('Account');
  }

  render() {
    const {confirmedBalance, unconfirmedBalance} = this.props;

    return (
      <div className="account">
        <div className="account__alert">
          <strong>Important:</strong> Transactions are disabled for the first two weeks of mainnet.
        </div>
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
              <div>Unlocked Balance</div>
              <Tooltipable
                tooltipContent="Unlocked balance equals your current balance that's written on the HNS blockchain. It does not reflect pending transactions.">
                <div className="account__info-icon" />
              </Tooltipable>
            </div>
            <div className="account__balance-wrapper">
              <div className="account__balance-wrapper__amount">{`HNS ${displayBalance(confirmedBalance)}`}</div>
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
}
