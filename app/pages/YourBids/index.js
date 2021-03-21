import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import BidStatus from './BidStatus';
import BidTimeLeft from './BidTimeLeft';
import BidAction from './BidAction';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import BidSearchInput from '../../components/BidSearchInput';
import { displayBalance } from '../../utils/balances';
import { formatName } from '../../utils/nameHelpers';
import Fuse from '../../vendor/fuse';
import './your-bids.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';
import * as bidsActions from "../../ducks/bids";
import Dropdown from "../../components/Dropdown";
import {getPageIndices} from "../../utils/pageable";
import c from "classnames";
import * as nameActions from "../../ducks/names";
import * as notifActions from "../../ducks/notifications";
import dbClient from "../../utils/dbClient";

const analytics = aClientStub(() => require('electron').ipcRenderer);

const ITEM_PER_DROPDOWN = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
];

const YOUR_BIDS_ITEMS_PER_PAGE_KEY = 'your-bids-items-per-page';

class YourBids extends Component {
  static propTypes = {
    yourBids: PropTypes.array.isRequired,
    getYourBids: PropTypes.func.isRequired,
    sendRedeemAll: PropTypes.func.isRequired,
    sendRevealAll: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  state = {
    isShowingNameClaimForPayment: false,
    currentPageIndex: 0,
    itemsPerPage: 10,
    query: '',
  };

  async componentDidMount() {
    analytics.screenView('Your Bids');
    this.props.getYourBids();
    const itemsPerPage = await dbClient.get(YOUR_BIDS_ITEMS_PER_PAGE_KEY);

    this.setState({
      itemsPerPage: itemsPerPage || 10,
    });
  }

  handleOnChange = async e => {
    this.setState({ query: e.target.value });
  };

  onRedeemAll = async () => {
    const {
      showError,
      showSuccess,
      sendRedeemAll,
    } = this.props;

    try {
      await sendRedeemAll();
      showSuccess('Your redeem request is submitted! Please wait about 15 minutes for it to complete.');
    } catch (e) {
      showError(e.message)
    }
  };

  onRevealAll = async () => {
    const {
      showError,
      showSuccess,
      sendRevealAll,
    } = this.props;

    try {
      await sendRevealAll();
      showSuccess('Your reveal request is submitted! Please wait about 15 minutes for it to complete.');
    } catch (e) {
      showError(e.message)
    }
  };

  render() {
    return (
      <div className="bids">
        <div className="bids__top">
          <BidSearchInput
            className="bids__search"
            onChange={this.handleOnChange}
            value={this.state.query}
          />
          <div className="bids__top__actions">
            <button
              className="bids__top__btn"
              onClick={this.onRevealAll}
            >
              Reveal All
            </button>
            <button
              className="bids__top__btn"
              onClick={this.onRedeemAll}
            >
              Redeem All
            </button>
          </div>
        </div>
        <Table className="bids-table">
          <Header />
          {this.renderRows()}
          {this.renderControls()}
        </Table>
      </div>
    );
  }

  renderGoTo() {
    const { currentPageIndex, itemsPerPage } = this.state;
    const { yourBids } = this.props;
    const totalPages = Math.ceil(yourBids.length / itemsPerPage);
    return (
      <div className="domain-manager__page-control__dropdowns">
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">Items per Page:</div>
          <Dropdown
            className="domain-manager__go-to__dropdown transactions__items-per__dropdown"
            items={ITEM_PER_DROPDOWN}
            onChange={async itemsPerPage => {
              await dbClient.put(YOUR_BIDS_ITEMS_PER_PAGE_KEY, itemsPerPage);
              this.setState({
                itemsPerPage,
                currentPageIndex: 0,
              })
            }}
            currentIndex={ITEM_PER_DROPDOWN.findIndex(({ value }) => value === this.state.itemsPerPage)}
          />
        </div>
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">Page</div>
          <Dropdown
            className="domain-manager__go-to__dropdown"
            items={Array(totalPages).fill(0).map((_, i) => ({ label: `${i + 1}` }))}
            onChange={currentPageIndex => this.setState({ currentPageIndex })}
            currentIndex={currentPageIndex}
          />
          <div className="domain-manager__go-to__total">of {totalPages}</div>
        </div>
      </div>
    )
  }

  renderControls() {
    const {
      currentPageIndex,
      itemsPerPage,
    } = this.state;
    const {
      yourBids,
    } = this.props;

    const totalPages = Math.ceil(yourBids.length / itemsPerPage);
    const pageIndices = getPageIndices(yourBids, itemsPerPage, currentPageIndex);

    return (
      <div className="domain-manager__page-control">
        <div className="domain-manager__page-control__numbers">
          <div
            className="domain-manager__page-control__start"
            onClick={() => this.setState({
              currentPageIndex: Math.max(currentPageIndex - 1, 0),
            })}
          />
          {pageIndices.map((pageIndex, i) => {
            if (pageIndex === '...') {
              return (
                <div key={`${pageIndex}-${i}`} className="domain-manager__page-control__ellipsis">...</div>
              );
            }

            return (
              <div
                key={`${pageIndex}-${i}`}
                className={c('domain-manager__page-control__page', {
                  'domain-manager__page-control__page--active': currentPageIndex === pageIndex,
                })}
                onClick={() => this.setState({ currentPageIndex: pageIndex })}
              >
                {pageIndex + 1}
              </div>
            )
          })}
          <div
            className="domain-manager__page-control__end"
            onClick={() => this.setState({
              currentPageIndex: Math.min(currentPageIndex + 1, totalPages - 1),
            })}
          />
        </div>
        {this.renderGoTo()}
      </div>
    )
  }

  renderRows() {
    const { yourBids, history } = this.props;
    const { query, currentPageIndex: s, itemsPerPage: n } = this.state;

    if (!yourBids.length) {
      return <EmptyResult />;
    }

    if (!this.fuse) {
      this.fuse = new Fuse(yourBids, {
        keys: ['name'],
        threshold: .4,
      });
    }

    const bids = query ? this.fuse.search(query) : yourBids;

    if (!bids.length) {
      return <EmptyResult />;
    }

    const start = s * n;
    const end = start + n;

    return bids.slice(start, end).map((bid, i) => (
      <TableRow key={`${bid.name}-${i}`} onClick={() => history.push(`/domain/${bid.name}`)}>
        <TableItem><BidStatus name={bid.name} /></TableItem>
        <TableItem>{formatName(bid.name)}</TableItem>
        <TableItem><BidTimeLeft name={bid.name} /></TableItem>
        <TableItem>{`${+displayBalance(bid.value)} HNS`}</TableItem>
        <TableItem><BidAction name={bid.name} /></TableItem>
      </TableRow>
    ));
  }
}

export default withRouter(
  connect(
    state => ({
      yourBids: state.bids.yourBids,
    }),
    dispatch => ({
      getYourBids: () => dispatch(bidsActions.getYourBids()),
      sendRedeemAll: () => dispatch(nameActions.sendRedeemAll()),
      sendRevealAll: () => dispatch(nameActions.sendRevealAll()),
      showError: (message) => dispatch(notifActions.showError(message)),
      showSuccess: (message) => dispatch(notifActions.showSuccess(message)),
    })
  )(YourBids)
);

function Header() {
  return (
    <HeaderRow>
      <HeaderItem>
        <div>Status</div>
      </HeaderItem>
      <HeaderItem>TLD</HeaderItem>
      <HeaderItem>Time Left</HeaderItem>
      <HeaderItem>Your Bid</HeaderItem>
      <HeaderItem />
    </HeaderRow>
  )
}

function EmptyResult() {
  return (
    <TableRow className="bids-table__empty-row">
      No Bids Found
    </TableRow>
  );
}
