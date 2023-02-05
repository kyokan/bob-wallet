import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';
import fs from 'fs';

import Transaction from './Transaction';
import './index.scss';
import { fetchTransactions } from '../../ducks/walletActions';
import Dropdown from '../Dropdown';
import BidSearchInput from '../BidSearchInput';
import Fuse from '../../vendor/fuse';
import dbClient from "../../utils/dbClient";
import walletClient from "../../utils/walletClient";
import {I18nContext} from "../../utils/i18n";
import { debounce } from '../../utils/throttle';

const {dialog} = require('@electron/remote');

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
    walletHeight: state.wallet.walletHeight,
  }),
  (dispatch) => ({
    fetchTransactions: () => dispatch(fetchTransactions()),
  })
)
export default class Transactions extends Component {
  static propTypes = {
    transactions: PropTypes.instanceOf(Map).isRequired,
    walletHeight: PropTypes.number.isRequired,
  };

  static contextType = I18nContext;

  async componentDidMount() {
    const itemsPerPage = await dbClient.get(TX_VIEW_ITEMS_PER_PAGE_KEY);

    this.setState({
      itemsPerPage: itemsPerPage || 5,
    });

    this.props.fetchTransactions();
  }

  async componentDidUpdate(prevProps, prevState) {

    // Refresh transactions on new blocks
    if (this.props.walletHeight !== prevProps.walletHeight) {
      this.refreshTransactions();
    }

    if (this.props.transactions.size !== prevProps.transactions.size) {
      this.fuse = null;
    }
  }

  refreshTransactions = debounce(() => this.props.fetchTransactions(), 5000)

  state = {
    currentPageIndex: 0,
    itemsPerPage: 5,
    sortBy: 0,
    query: '',
  };

  handleOnChange = e => this.setState({ query: e.target.value, currentPageIndex: 0 });

  onExport = async () => {
    const headers = ['time', 'txhash', 'fee', 'type', 'value', 'domains'];
    let csvData = headers.join(',') + '\n';

    for (const [_, tx] of this.props.transactions) {
      const row = {
        time: new Date(tx.date).toISOString(),
        txhash: tx.id,
        fee: tx.fee,
        type: tx.type,
        value: (isNegativeValue(tx.type) ? -tx.value : tx.value) / 1e6,
        domains: tx.domains?.join(', ') || tx.meta.domain || '',
      }
      csvData += headers.map(key => `"${row[key]}"`).join(',') + '\n'
    }

    const savePath = dialog.showSaveDialogSync({
      filters: [{name: 'spreadsheet', extensions: ['csv']}],
    });
    if (savePath) {
      fs.writeFile(savePath, csvData, (err) => {
        if (err) {
          throw err;
        }
      });
    }
  }

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
    const {t} = this.context;
    let i = currentPageIndex * itemsPerPage;
    let result = [];
    const len = i + itemsPerPage;

    const transactions = this.getTransactions();

    if (!transactions.length) {
      result.push(
        <div key="empty" className="transactions__empty-list">
          {t('txnsEmpty')}
        </div>
      );
    }

    for (;i < len; i++) {
      const tx = transactions[i];
      if (tx) {
        result.push(
          <div className="transaction__container" key={tx.id+tx.pending}>
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
            placeholder={t('txnsSearchPlaceholder')}
            onChange={this.handleOnChange}
            value={this.state.query}
          />
          <div className="transactions__go-to">
            <div className="transactions__go-to__text">{t('sortBy')}:</div>
            <Dropdown
              className="transactions__go-to__dropdown transactions__sort-by__dropdown"
              items={SORT_BY_DROPDOWN}
              onChange={sortBy => this.setState({ sortBy })}
              currentIndex={this.state.sortBy}
            />
          </div>
          <div className="transactions__export">
            <button
              className="watching__download"
              onClick={this.onExport}
            >
              {t('export')}
            </button>
          </div>
        </div>
        {result}
        {this.renderPageNumbers(transactions)}
      </div>
    );
  }

  renderGoTo(transactions) {
    const {t} = this.context;
    const { currentPageIndex, itemsPerPage } = this.state;
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    return (
      <div className="transactions__page-control__dropdowns">
        <div className="transactions__go-to">
          <div className="transactions__go-to__text">{t('itemsPerPage')}:</div>
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
          <div className="transactions__go-to__text">{t('page')}</div>
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

function isNegativeValue(type) {
  switch (type) {
    // Positive
    case 'RECEIVE':
    case 'COINBASE':
    case 'REDEEM':
    case 'REVEAL':
    case 'REGISTER':
      return false;

    // Neutral
    case 'UPDATE':
    case 'RENEW':
    case 'OPEN':
    case 'FINALIZE':
    case 'CLAIM':
      return false;

    // Negative
    case 'SEND':
    case 'BID':
      return true;

    // Should not reach here
    default:
      return false;
  }
}