import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import Transaction from './Transaction';
import './index.scss';
// Dummy transactions state until we have ducks
import { fetchTransactions } from '../../ducks/wallet';

@connect(
  (state) => ({
    transactions: state.wallet.transactions,
  }),
  (dispatch) => ({
    fetchTransactions: () => dispatch(fetchTransactions())
  })
)
export default class Transactions extends Component {
  static propTypes = {
    transactionsDummyOrder: PropTypes.array.isRequired
  };

  async componentDidMount() {
    await this.props.fetchTransactions()
  }

  render() {
    if (!this.props.transactions.length) {
      return (
        <div className="account__empty-list">
          You do not have any transactions
        </div>
      );
    }

    return this.props.transactions.map((tx) => (
      <div className="transaction__container" key={tx.id}>
        <Transaction transaction={tx} />
      </div>
    ));
  }
}

//TODO: Connect component to Redux and grab transactionsOrder directly
