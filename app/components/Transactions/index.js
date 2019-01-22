import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';

import Transaction from './Transaction';
import './index.scss';
// Dummy transactions state until we have ducks
import { fetchTransactions } from '../../ducks/wallet';
import Dropdown from '../Dropdown';
import BidSearchInput from '../BidSearchInput';

const SORT_BY_TYPES = {
  DATE_DESCENDING: 'Date - Descending',
  DATE_ASCENDING: 'Date - Ascending',
};

const SORT_BY_DROPDOWN = [
  { label: SORT_BY_TYPES.DATE_DESCENDING },
  { label: SORT_BY_TYPES.DATE_ASCENDING },
];

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
    transactions: PropTypes.array.isRequired
  };

  async componentDidMount() {
    await this.props.fetchTransactions()
  }

  state = {
    currentPageIndex: 0,
    itemsPerPage: 5,
    sortBy: 0,
  };

  render() {
    const { currentPageIndex, itemsPerPage, sortBy } = this.state;
    let i = currentPageIndex * itemsPerPage;
    let result = [];
    const len = i + itemsPerPage;
    const transactions = sortBy === 1
      ? this.props.transactions.slice().reverse()
      : this.props.transactions;

    if (!transactions.length) {
      return (
        <div className="account__empty-list">
          You do not have any transactions
        </div>
      );
    }

    for (;i < len; i++) {
      const tx = transactions[i];
      if (tx) {
        result.push(
          <div className="transaction__container" key={tx.id}>
            <Transaction transaction={tx} />
          </div>
        );
      }
    }

    return (
      <div className="transactions">
        <div className="transactions__header">
          <BidSearchInput
            className="transactions__search"
            placeholder="Search your transaction history"
            // onChange={this.handleOnChange}
            // value={this.state.query}
          />
          <div className="transactions__go-to">
            <div className="transactions__go-to__text">Sort By:</div>
            <Dropdown
              className="transactions__go-to__dropdown transactions__sort-by__dropdown"
              items={SORT_BY_DROPDOWN}
              onChange={sortBy => this.setState({ sortBy })}
              currentIndex={this.state.sortBy}
            />
          </div>
        </div>
        {result}
        {this.renderPageNumbers()}
      </div>
    );
  }

  renderGoTo() {
    const { currentPageIndex, itemsPerPage } = this.state;
    const { transactions } = this.props;
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    return (
      <div className="transactions__go-to">
        <div className="transactions__go-to__text">Page</div>
        <Dropdown
          className="transactions__go-to__dropdown"
          items={Array(totalPages).fill(0).map((_, i) => ({ label: `${i + 1}` }))}
          onChange={currentPageIndex => this.setState({ currentPageIndex })}
          currentIndex={currentPageIndex}
        />
        <div className="transactions__go-to__total">of {totalPages}</div>
      </div>
    )
  }

  renderPageNumbers() {
    const { currentPageIndex, itemsPerPage } = this.state;
    const { transactions } = this.props;
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    const pageIndices = getPageIndices(transactions, itemsPerPage, currentPageIndex);

    return (
      <div className="transactions__page-control">
        <div className="transactions__page-control__numbers">
          <div
            className="transactions__page-control__start"
            onClick={() => this.setState({
              currentPageIndex: Math.max(currentPageIndex - 1, 0),
            })}
          />
          {pageIndices.map((pageIndex, i) => {
            if (pageIndex === '...') {
              return (
                <div key={`${pageIndex}-${i}`} className="transactions__page-control__ellipsis">...</div>
              );
            }

            return (
              <div
                key={`${pageIndex}-${i}`}
                className={c('transactions__page-control__page', {
                  'transactions__page-control__page--active': currentPageIndex === pageIndex,
                })}
                onClick={() => this.setState({ currentPageIndex: pageIndex })}
              >
                {pageIndex + 1}
              </div>
            )
          })}
          <div
            className="transactions__page-control__end"
            onClick={() => this.setState({
              currentPageIndex: Math.min(currentPageIndex + 1, totalPages - 1),
            })}
          />
        </div>
        {this.renderGoTo()}
      </div>
    );
  }
}

//TODO: Connect component to Redux and grab transactionsOrder directly

function getPageIndices(transactions, itemsPerPage, currentPageIndex) {
  const totals = Math.ceil(transactions.length / itemsPerPage);
  const results = [];

  if (totals < 7) {
    return Array(totals)
      .fill(0)
      .map((_, n) => n);
  }

  results.push(0);

  for (let i = currentPageIndex - 1; i < currentPageIndex + 2; i++) {
    if (i >= 0 && i < totals) {
      results.push(i);
    }
  }

  results.push(totals - 1);
  const pageIndices = [ ...new Set(results) ];

  const answer = [];
  pageIndices.forEach((pageIndex, index) => {
    if (index === 0) {
      answer.push(pageIndex);
      return;
    }

    if (pageIndices[index - 1] + 1 !== pageIndices[index]) {
      answer.push('...');
    }

    answer.push(pageIndex);
  });
  return answer;
}
