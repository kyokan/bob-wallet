import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import * as domainActions from '../../../ducks/domains';
import { BiddingOpen, BiddingClose } from './Bidding';
import { CloseInfo, OpenInfo, SoldInfo, ReserveInfo } from './info';
import './auction.scss';
// import { AUCTION_STATE } from '../../../ducks/domains';

const AVAILABLE = 0;
const SOLD = 1;
const RESERVE = 2;

const LAUNCH_DATE = new Date('October 1, 2018');

function addDays(start = new Date(), days = 0) {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

function isEarlierThan(startDate, endDate) {
  return (
    startDate.toISOString().split('T')[0] < endDate.toISOString().split('T')[0]
  );
}

export const ACTION_PROCESS = {
  title: 'The Auction Process',
  0: `
    To prevent price sniping, Handshake uses a blind second-price auction called a Vickrey Auction. Users can buy and register top-level domains (TOLDs) with Handshake coins (HNS).
  `,
  1: `
    In a Vickrey Auction, a participant is only aware of their own bid. The bids are revealed at the end of the auction when a winner is chosen. The winner pays the second highest bid instead of his or her own.
  `,
  2: `
    Names are released weekly during a pre-determined 52 week schedule
  `,
  3: `
    Blind bids can be placed any time after a name is released
  `,
  4: `
    Bidding is open to everyone for 5 days after the reveal period
  `,
  5: `
    Bidders have 10 days to reveal their bid price
  `,
  6: `
    A winner is assigned the name and pays the second highest bid at the end of the reveal period
  `,
  7: `
    Bidders have 10 days to reveal their bid price
  `,
  8: `
    A winner is assigned the name and payes the second highest bid at the end of the reveal period
  `,
  9: `
    The winning bid is burned and permanently removed from circulation
  `,
  10: `
    Losing bids are returned
  `,
  11: `
    Names are renewed annually by paying standard network fee
  `,
  // link here
  12: `
    Read the Handshake paper for more details.
  `
};

const isLimitedTimeRemaining = biddingCloseDate => {
  if (!biddingCloseDate) {
    return false;
  }

  return isEarlierThan(biddingCloseDate, addDays(new Date(), 7));
};

const defaultBiddingClose = (
  <div className="auction__group">
    <div className="auction__title">Bidding close</div>
    <div className="auction__large">5 days after the 1st bid</div>
    <div className="auction__block" />
    <div className="auction__small-text auction__limited-time auction__open-bid-description">
      If no bids are placed 7 days after auction opens, this TLD will be
      randomly assigned a new auction open date to prevent squatting.
    </div>
  </div>
);

const statusToMessage = status =>
  ({
    [AVAILABLE]: <div className="auction__green">Available</div>,
    [SOLD]: <div className="auction__red">Sold</div>,
    [RESERVE]: <div className="auction__black">Reserved</div>
  }[status]);

function getStatus(domain = {}, bids = []) {
  const closeDate = getCloseDate(domain, bids);

  if (domain.start && domain.start.reserved) {
    return RESERVE;
  }

  if (domain.info && domain.info.owner) {
    return SOLD;
  }

  if (closeDate && isEarlierThan(closeDate, new Date())) {
    // TODO: Is there a state for when a TLD has past 7 days without bids?
  }

  return AVAILABLE;
}

function getCloseDate(domain = {}, bids = []) {
  if (!domain.start) {
    return null;
  }

  if (domain.info && domain.info.owner) {
    return bids[0] && bids[0].timePlaced;
  }

  if (bids.length === 0) {
    return addDays(LAUNCH_DATE, domain.start.week * 7 + 7);
  } else {
    return addDays(bids[0].timePlaced, 5);
  }
}

@withRouter
@connect(
  (state, ownProps) => {
    const domain = state.domains[ownProps.match.params.name] || {};
    const bids = [
      // {
      //   timePlaced: new Date('October 6, 2018'), // Date,
      //   bidder: 'you', // you or hexString,
      //   bidAmount: 2500.5 // number HNS
      // },
    ];

    return {
      status: getStatus(domain),
      bids,
      biddingOpenDate: domain.start
        ? addDays(LAUNCH_DATE, domain.start.week * 7)
        : null,
      biddingOpenWeek: domain.start ? domain.start.week : null,
      biddingOpenBlock: domain.start && domain.start.start,
      biddingCloseDate: getCloseDate(domain, bids),
      biddingCloseBlock: null,
      paidValue: domain.info && domain.info.value,
      owner: domain.info && domain.info.owner
    };
  },
  dispatch => ({
    getNameInfo: tld => dispatch(domainActions.getNameInfo(tld))
  })
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
    bids: PropTypes.arrayOf(
      PropTypes.shape({
        timePlaced: PropTypes.instanceOf(Date),
        bidder: PropTypes.string,
        bidAmount: PropTypes.string
      })
    ).isRequired,
    status: PropTypes.oneOf([AVAILABLE, SOLD, RESERVE]),
    biddingCloseBlock: PropTypes.number,
    biddingOpenBlock: PropTypes.number,
    paidValue: PropTypes.number,
    owner: PropTypes.string,
    biddingCloseDate: PropTypes.instanceOf(Date),
    biddingOpenDate: PropTypes.instanceOf(Date),
    biddingOpenWeek: PropTypes.number
  };

  componentWillMount() {
    this.props.getNameInfo(this.getDomain());
  }

  getDomain = () => this.props.match.params.name;

  renderAuctionRight = () => {
    const {
      biddingOpenDate,
      biddingCloseDate,
      status,
      bids,
      paidValue,
      owner
    } = this.props;

    if (status === RESERVE) {
      return <ReserveInfo />;
    }

    if (status === SOLD) {
      return <SoldInfo owner={owner} paidValue={paidValue} />;
    }

    const isBiddingOpen =
      biddingOpenDate && biddingOpenDate.getTime() > new Date().getTime();

    if (isBiddingOpen) {
      return <OpenInfo biddingOpenDate={biddingOpenDate} />;
    }

    return <CloseInfo biddingCloseDate={biddingCloseDate} bids={bids} />;
  };

  renderAuctionLeft = () => {
    const { status, biddingCloseDate } = this.props;

    const isSold = status === SOLD;
    const domain = this.getDomain();
    const statusMessage = statusToMessage(status);

    return (
      <React.Fragment>
        <div className="auction__domain">{`${domain}/`}</div>
        {isSold && (
          <div
            className="auction__visit"
            onClick={() => window.open(`http://.${domain}`, '_blank')}
          >
            <span>Visit</span>
            <span className="auction__visit-icon" />
          </div>
        )}
        <div className="auction__underline" />
        <div className="auction__left">
          <div className="auction__group">
            <div className="auction__title">Status</div>
            <div className="auction__status">
              <div className="auction__status-message">{statusMessage}</div>
              {// TODO this function confusingly is also true if already sold
              isLimitedTimeRemaining(biddingCloseDate) && !isSold ? (
                // TODO refactor these css names that got confusing and wierd through iteration
                <div className="auction__limited-time__clock auction__limited auction__limited-time--small">
                  <div className="auction__clock-svg" />
                  <div className="auction__limited-time__text">
                    limited time remaining!
                  </div>
                </div>
              ) : null}
            </div>
            {this.renderStatusMessage()}
          </div>
          {this.renderBiddingOpen()}
          {this.renderBiddingClose()}
        </div>
      </React.Fragment>
    );
  };

  render() {
    return (
      <div className="auction">
        <div className="auction__top">
          {this.renderAuctionLeft()}
          {this.renderAuctionRight()}
        </div>
      </div>
    );
  }

  renderStatusMessage() {
    const { status, biddingOpenWeek, paidValue } = this.props;

    if (paidValue && status === SOLD) {
      return <div className="auction__paid-bid">{`${paidValue} HNS`}</div>;
    }

    if (status === RESERVE) {
      return (
        <div className="auction__reserve-status-message">
          <span className="auction__reserve-status-message__text">
            for the trademark name holder.
          </span>
          <span className="auction__reserve-status-message__link">
            Submit proof
          </span>
        </div>
      );
    }

    if (status === AVAILABLE) {
      return (
        <a className="auction__bid-open-week">{`Week ${biddingOpenWeek}`}</a>
      );
    }
  }

  renderBiddingOpen() {
    const { status, biddingOpenDate, biddingOpenBlock } = this.props;

    return (
      <BiddingOpen
        date={status === RESERVE ? 'N/A' : biddingOpenDate}
        block={status === RESERVE ? 'N/A' : biddingOpenBlock}
      />
    );
  }

  renderBiddingClose = () => {
    const { status, bids, biddingCloseDate, biddingCloseBlock } = this.props;

    if (status === RESERVE) {
      return <BiddingClose date={'N/A'} block={'N/A'} />;
    }

    return !bids.length ? (
      defaultBiddingClose
    ) : (
      <BiddingClose date={biddingCloseDate} block={biddingCloseBlock} />
    );
  };
}
