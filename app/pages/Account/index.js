import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Transactions from '../../components/Transactions';
import './account.scss';
import { displayBalance } from '../../utils/balances';

@connect(
  (state) => ({
    confirmedBalance: state.wallet.balance.confirmed,
    unconfirmedBalance: state.wallet.balance.unconfirmed
  })
)
export default class Account extends Component {
  static propTypes = {
    confirmedBalance: PropTypes.number.isRequired,
    unconfirmedBalance: PropTypes.number.isRequired,
  };

  render() {
    const {confirmedBalance, unconfirmedBalance} = this.props;

    return (
      <div className="account">
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
              <div className="account__info-icon" />
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
