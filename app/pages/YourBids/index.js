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
import {NAME_STATES} from "../../constants/names";
import {I18nContext} from "../../utils/i18n";

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
    order: PropTypes.array.isRequired,
    map: PropTypes.object.isRequired,
    getYourBids: PropTypes.func.isRequired,
    sendRedeemAll: PropTypes.func.isRequired,
    sendRevealAll: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  state = {
    isShowingNameClaimForPayment: false,
    activeFilter: '',
    currentPageIndex: 0,
    itemsPerPage: 10,
    query: '',
    loading: true,
  };

  async componentDidMount() {
    analytics.screenView('Your Bids');
    this.props.getYourBids()
      .then(() => this.setState({ loading: false }));
    const itemsPerPage = await dbClient.get(YOUR_BIDS_ITEMS_PER_PAGE_KEY);
    this.setState({
      itemsPerPage: itemsPerPage || 10,
      activeFilter: this.props.match.params.filterType || '',
    });
  }

  handleOnChange = async e => {
    this.setState({ query: e.target.value });
  };

  onRegisterAll = async () => {
    const {
      showError,
      showSuccess,
      sendRegisterAll,
    } = this.props;

    try {
      const res = await sendRegisterAll();
      if (res !== null) {
        showSuccess(this.context.t('registerSuccess'));
      }
    } catch (e) {
      showError(e.message)
    }
  };

  onRedeemAll = async () => {
    const {
      showError,
      showSuccess,
      sendRedeemAll,
    } = this.props;

    try {
      const res = await sendRedeemAll();
      if (res !== null) {
        showSuccess(this.context.t('redeemSuccess'));
      }
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
      const res = await sendRevealAll();
      if (res !== null) {
        showSuccess(this.context.t('revealSuccess'));
      }
    } catch (e) {
      showError(e.message)
    }
  };

  getCurrentBids() {
    const {order, map, filter} = this.props;
    const {activeFilter} = this.state;

    if (activeFilter) {
      return filter[activeFilter]?.map(id => map[id]) || [];
    } else {
      return order?.map(id => map[id]) || [];
    }
  }

  render() {
    const {t} = this.context;
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
              {t('revealAll')}
            </button>
            <button
              className="bids__top__btn"
              onClick={this.onRedeemAll}
            >
              {t('redeemAll')}
            </button>
            <button
              className="bids__top__btn"
              onClick={this.onRegisterAll}
            >
              {t('registerAll')}
            </button>
          </div>
        </div>
        <div className="bids__filters">
          {this.renderFilter(t('all'), '')}
          {this.renderFilter(t('bidding'), NAME_STATES.BIDDING)}
          {this.renderFilter(t('reveal'), NAME_STATES.REVEAL)}
          {this.renderFilter(t('closed'), NAME_STATES.CLOSED)}
        </div>
        <Table className="bids-table">
          <Header />
          {this.renderRows()}
          {this.renderControls()}
        </Table>
      </div>
    );
  }

  renderFilter = (label, value) => {
    const {activeFilter} = this.state;
    const { filter, order } = this.props;
    const count = value ? filter[value].length : order.length;

    return (
      <div
        className={c('bids__filter', {
          'bids__filter--active': activeFilter === value,
        })}
        onClick={() => this.setState({ activeFilter: value })}
      >
        {`${label} (${count})`}
      </div>
    )
  };

  renderGoTo() {
    const { currentPageIndex, itemsPerPage } = this.state;
    const {t} = this.context;
    const yourBids = this.getCurrentBids();
    const totalPages = Math.ceil(yourBids.length / itemsPerPage);
    return (
      <div className="domain-manager__page-control__dropdowns">
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">{t('itemsPerPage')}:</div>
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
          <div className="domain-manager__go-to__text">{t('page')}</div>
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

    const yourBids = this.getCurrentBids();

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
    const { history } = this.props;
    const { query, currentPageIndex: s, itemsPerPage: n, loading } = this.state;

    if (loading) {
      return <LoadingResult />;
    }

    const yourBids = this.getCurrentBids();

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
      order: state.bids.order,
      map: state.bids.map,
      filter: state.bids.filter,
    }),
    dispatch => ({
      getYourBids: () => dispatch(bidsActions.getYourBids()),
      sendRedeemAll: () => dispatch(nameActions.sendRedeemAll()),
      sendRevealAll: () => dispatch(nameActions.sendRevealAll()),
      sendRegisterAll: () => dispatch(nameActions.sendRegisterAll()),
      showError: (message) => dispatch(notifActions.showError(message)),
      showSuccess: (message) => dispatch(notifActions.showSuccess(message)),
    })
  )(YourBids)
);

class Header extends Component {
  static contextType = I18nContext;

  render() {
    const {t} = this.context;
    return (
      <HeaderRow>
        <HeaderItem>
          <div>{t('status')}</div>
        </HeaderItem>
        <HeaderItem>{t('domain')}</HeaderItem>
        <HeaderItem>{t('timeLeft')}</HeaderItem>
        <HeaderItem>{t('yourBid')}</HeaderItem>
        <HeaderItem />
      </HeaderRow>
    )
  }

}

class EmptyResult extends Component {
  static contextType = I18nContext;

  render() {
    return (
      <TableRow className="bids-table__empty-row">
        {this.context.t('yourBidsEmpty')}
      </TableRow>
    );
  }

}


class LoadingResult extends Component {
  static contextType = I18nContext;

  render() {
    return (
      <TableRow className="bids-table__empty-row">
        {this.context.t('loading')}
      </TableRow>
    );
  }

}
