import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';

import Transaction from './Transaction';
import './index.scss';
// Dummy transactions state until we have ducks
import { fetchTransactions, fetchPendingTransactions } from '../../ducks/walletActions';
import Dropdown from '../Dropdown';
import BidSearchInput from '../BidSearchInput';
import Fuse from '../../vendor/fuse';
import dbClient from "../../utils/dbClient";

const SORT_BY_TYPES = {
  DATE_DESCENDING: 'Date - Descending',
  DATE_ASCENDING: 'Date - Ascending',
};

const SORT_BY_DROPDOWN = [
  { label: SORT_BY_TYPES.DATE_DESCENDING },
  { label: SORT_BY_TYPES.DATE_ASCENDING },
];

const ITEM_PER_DROPDOWN = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
];

const TX_VIEW_ITEMS_PER_PAGE_KEY = 'main-tx-items-per-page';

@connect(
  (state) => ({
    transactions: state.wallet.transactions,
  }),
  (dispatch) => ({
    fetchTransactions: () => dispatch(fetchTransactions()),
    fetchPendingTransactions: () => dispatch(fetchPendingTransactions()),
  })
)
export default class Transactions extends Component {
  static propTypes = {
    transactions: PropTypes.instanceOf(Map).isRequired,
  };

  async componentWillMount() {
    const itemsPerPage = await dbClient.get(TX_VIEW_ITEMS_PER_PAGE_KEY);

    this.setState({
      itemsPerPage: itemsPerPage || 5,
    });
  }

  async componentDidMount() {
    await this.props.fetchTransactions();
    await this.props.fetchPendingTransactions();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.transactions.size !== nextProps.transactions.size) {
      this.fuse = null;
    }
  }

  state = {
    currentPageIndex: 0,
    itemsPerPage: 5,
    sortBy: 0,
    query: '',
  };

  handleOnChange = e => this.setState({ query: e.target.value, currentPageIndex: 0 });

  getTransactions() {
    const { sortBy, query } = this.state;
    let transactions = Array.from(this.props.transactions.values());

    if (!this.fuse) {
      this.fuse = new Fuse(transactions, {
        keys: ['id', 'meta.to', 'meta.from', 'type', 'meta.domain', 'value'],
        shouldSort: false,
        threshold: .3,
      });
    }

    if (query) {
      transactions = this.fuse.search(query);
    }

    transactions = sortBy === 1
      ? transactions.reverse()
      : transactions;

    return transactions;
  }

  render() {
    const { currentPageIndex, itemsPerPage } = this.state;
    let i = currentPageIndex * itemsPerPage;
    let result = [];
    const len = i + itemsPerPage;

    const transactions = this.getTransactions();

    if (!transactions.length) {
      result.push(
        <div key="empty" className="transactions__empty-list">
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
            onChange={this.handleOnChange}
            value={this.state.query}
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
        {this.renderPageNumbers(transactions)}
      </div>
    );
  }

  renderGoTo(transactions) {
    const { currentPageIndex, itemsPerPage } = this.state;
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    return (
      <div className="transactions__page-control__dropdowns">
        <div className="transactions__go-to">
          <div className="transactions__go-to__text">Items per Page:</div>
          <Dropdown
            className="transactions__go-to__dropdown transactions__items-per__dropdown"
            items={ITEM_PER_DROPDOWN}
            onChange={async itemsPerPage => {
              await dbClient.put(TX_VIEW_ITEMS_PER_PAGE_KEY, itemsPerPage);
              this.setState({
                itemsPerPage,
                currentPageIndex: 0,
              })
            }}
            currentIndex={ITEM_PER_DROPDOWN.findIndex(({ value }) => value === this.state.itemsPerPage)}
          />
        </div>
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
      </div>
    )
  }

  renderPageNumbers(transactions) {
    const { currentPageIndex, itemsPerPage } = this.state;
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
        {this.renderGoTo(transactions)}
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
