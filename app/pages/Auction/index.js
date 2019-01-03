import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cn from 'classnames';
import * as names from '../../ducks/names';
import * as auctions from '../../ducks/auctions';
import { CloseInfo, OpenInfo, SoldInfo, ReserveInfo } from './info';
import BidNow from './BidNow';
import Collapsible from '../../components/Collapsible';
import './auction.scss';
import './domains.scss';

@withRouter
@connect(
  (state, ownProps) => {
    const { name } = ownProps.match.params;
    const domain = names.getDomain(state, name);
    const bids = [];

    return {
      // New
      domain,
      isAvailable: names.getIsAvailable(state, name),
      isReserved: names.getIsReserved(state, name),
      biddingOpenDate: names.getBiddingOpenDate(state, name),
      biddingOpenBlock: domain.start && domain.start.start,
      biddingCloseDate: names.getBiddingCloseDate(state, name),
      biddingCloseBlock: null,
      // /New
      bids,
      biddingOpenWeek: domain.start && domain.start.week,
      paidValue: domain.info && domain.info.value,
      owner: domain.info && domain.info.owner,
    };
  },
  dispatch => ({
    getNameInfo: tld => dispatch(names.getNameInfo(tld)),
    getAuctionInfo: tld => dispatch(auctions.getAuctionInfo(tld)),
  }),
)
export default class Auction extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }),
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }),
    match: PropTypes.shape({
      params: PropTypes.shape({
        name: PropTypes.string.isRequired
      })
    }),
    getNameInfo: PropTypes.func.isRequired,
    getAuctionInfo: PropTypes.func.isRequired,
    start: PropTypes.shape({
      reserved: PropTypes.bool,
      week: PropTypes.number,
      start: PropTypes.number,
    }),
    info: PropTypes.shape({
      state: PropTypes.oneOf(['BIDDING', 'REVEAL', 'CLOSED', 'REVOKED', 'TRANSFER']),
    }),
    isAvailable: PropTypes.bool.isRequired,
    isReserved: PropTypes.bool.isRequired,
    biddingCloseBlock: PropTypes.number,
    biddingOpenBlock: PropTypes.number,
    biddingCloseDate: PropTypes.instanceOf(Date),
    biddingOpenDate: PropTypes.instanceOf(Date),
  };

  componentWillMount() {
    this.props.getNameInfo(this.getDomain())
      .catch(e => console.error(e.message));

    this.props.getAuctionInfo(this.getDomain())
      .catch(e => console.error(e.message));
  }

  getDomain = () => this.props.match.params.name;

  renderAuctionRight = () => {
    const {
      isReserved,
      isAvailable,
      biddingOpenDate,
      biddingCloseDate,
      bids,
      paidValue,
      owner,
    } = this.props;

    if (isReserved) {
      return <ReserveInfo />;
    }

    if (owner && owner.hash) {
      return <SoldInfo owner={owner && owner.hash} paidValue={paidValue} />;
    }

    if (isAvailable) {
      return <BidNow name={this.getDomain()} />;
    }

    return <CloseInfo biddingCloseDate={biddingCloseDate} bids={bids} />;
  };

  render() {
    return (
      <div className="domains">
        { this.renderContent() }
        <div className="domains__action">
          {this.renderAuctionRight()}
        </div>
      </div>
    );
  }

  renderContent() {
    const domain = this.getDomain();

    return (
      <React.Fragment>
        <div className="domains__content">
          <div className="domains__content__title">{`${domain}/`}</div>
          <div className="domains__content__info-panel">
            <div className="domains__content__info-panel__title">Auction Details</div>
            <div className="domains__content__info-panel__content">
              {this.renderStatusMessage()}
              {this.renderBiddingOpen()}
              {this.renderBiddingClose()}
              {this.renderReveal()}
            </div>
          </div>
          <Collapsible  className="domains__content__info-panel" title="Bid History" defaultCollapsed>
            hi
          </Collapsible>
          <Collapsible  className="domains__content__info-panel" title="Vickrey Auction Process" defaultCollapsed>
            hi
          </Collapsible>
        </div>
      </React.Fragment>
    );
  }

  renderStatusMessage() {
    const { domain, isAvailable, isReserved } = this.props;
    const { state } = domain.info || {};
    const className = 'domains__content__auction-detail';
    let status = 'Unavailable';

    if (isReserved) {
      status = 'Reserved';
    } else if (isAvailable) {
      status = 'Available';
    } else if (state === names.NAME_STATES.CLOSED) {
      status = 'Closed';
    }

    return (
      <div
        className={cn(className, {
          [className + '--available']: isAvailable,
          [className + '--reserved']: isReserved,
          [className + '--closed']: state === names.NAME_STATES.CLOSED,
        })}
      >
        <div className={`${className}__label`}>Status:</div>
        <div className={`${className}__status`}>{status}</div>
      </div>
    );
  }

  renderBiddingOpen() {
    const { isAvailable, biddingOpenDate, biddingOpenBlock } = this.props;
    const className = 'domains__content__auction-detail';
    let status = 'N/A';
    let desc = '';

    if (isAvailable) {
      status = toDate(biddingOpenDate);
      desc = `Block # ${biddingOpenBlock}`;
    }

    return (
      <div className={className}>
        <div className={`${className}__label`}>Bidding Open:</div>
        <div className={`${className}__status`}>{status}</div>
        <div className={`${className}__description`}>{desc}</div>
      </div>
    );
  }

  renderBiddingClose = () => {
    const { isAvailable, biddingCloseDate } = this.props;
    const className = 'domains__content__auction-detail';
    let status = 'N/A';

    if (isAvailable) {
      status = toDate(biddingCloseDate);
    }

    return (
      <div className={className}>
        <div className={`${className}__label`}>Bidding Close:</div>
        <div className={`${className}__status`}>{status}</div>
      </div>
    );
  }

  renderReveal = () => {
    const className = 'domains__content__auction-detail';
    return (
      <div className={className}>
        <div className={`${className}__label`}>Reveal:</div>
        <div className={`${className}__status`}>N/A</div>
      </div>
    );
  }
}

function toDate(d) {
  const YYYY = d.getYear() + 1900;
  const M = d.getMonth() + 1;
  const D = d.getDate();
  return `${M}/${D}/${YYYY}`;
}
