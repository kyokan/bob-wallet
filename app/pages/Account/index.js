import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { BigNumber as bn } from 'bignumber.js';

import Modal from '../../components/Modal/index';
import Transactions from '../../components/Transactions';
import './account.scss';

// Dummy transactions state until we have ducks
import { transactionsDummyOrder } from '../../utils/mockingTransactionsState';

class Account extends Component {
  static propTypes = {
    accountBase: PropTypes.string.isRequired,
    accountIndex: PropTypes.number.isRequired,
    balance: PropTypes.object.isRequired,
    domains: PropTypes.array.isRequired
  };

  static defaultProps = {
    accountBase: 'm/44`/5353`/',
    accountIndex: 0,
    balance: bn(0),
    transactions: [],
    domains: []
  };

  state = {
    isShowingAccountModal: false
  };

  openModal = () => this.setState({ isShowingAccountModal: true });
  closeModal = () => this.setState({ isShowingAccountModal: false });

  renderEmpty = text => <div className="account__empty-list">{text}</div>;

  renderTransactions() {
    return !transactionsDummyOrder.length ? (
      this.renderEmpty('You do not have any transactions')
    ) : (
      <Transactions />
    );
  }

  renderDomains() {
    const { domains } = this.props;

    return !domains.length
      ? this.renderEmpty(
          'No domains yet. Get your first domain here. (add CTA button)'
        )
      : domains.map(() => <div>I am a domain</div>);
  }

  renderAccountModal() {
    const { accountBase, accountIndex } = this.props;

    return !this.state.isShowingAccountModal ? null : (
      <Modal
        className="account__switch-account-modal"
        onClose={this.closeModal}
      >
        <div className="account__switch-account-modal__wrapper">
          <div
            className="account__switch-account-modal__close-btn"
            onClick={this.closeModal}
          >
            ✕
          </div>
          <div className="account__switch-account-modal__header">
            <div className="account__switch-account-modal__title">
              Switch Account
            </div>
            <div className="account__switch-account-modal__subtitle">
              Enter an account index you would like to interact with
            </div>
          </div>
          <div className="account__switch-account-modal__content">
            <div className="account__switch-account-modal__account-base">{`${accountBase}`}</div>
            <input
              type="number"
              className="account__switch-account-modal__account-index"
              placeholder={accountIndex}
              min="0"
            />
          </div>
          <div className="account__switch-account-modal__footer">
            <button className="account__switch-account-modal__btn">
              Switch
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  render() {
    // const { balance } = this.props;
    const balance = bn(0);

    return (
      <div className="account">
        <div className="account__header">
          <div className="account__header-section">
            <div className="account__address">
              <div>Total Balance</div>
            </div>
            <div className="account__balance-wrapper">
              <div className="account__balance-wrapper__amount">{`HNS ${balance.toFixed(
                5
              )}`}</div>
            </div>
          </div>
          <div className="account__header-section">
            <div className="account__address">
              <div>Unlocked Balance</div>
              <div className="account__info-icon" />
            </div>
            <div className="account__balance-wrapper">
              <div className="account__balance-wrapper__amount">{`HNS ${balance.toFixed(
                5
              )}`}</div>
            </div>
          </div>
        </div>
        <div className="account__content">
          <div className="account__domains">
            <div className="account__panel-title">Your Domains</div>
            {this.renderDomains()}
          </div>
        </div>
        <div className="account__transactions">
          <div className="account__panel-title">Transaction History</div>
          {this.renderTransactions()}
        </div>
        {this.renderAccountModal()}
      </div>
    );
  }
}

// export default connect(state => ({
//   balance: bn(state.wallet.balance.confirmed)
// }))(Account);

export default Account;
