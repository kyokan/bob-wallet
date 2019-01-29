import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import c from 'classnames';
import AddToCalendar from 'react-add-to-calendar';
import { protocol } from 'hsd';
import { isAvailable, isBidding, isClosed, isOpening, isReveal } from '../../../utils/name-helpers';
import * as nameActions from '../../../ducks/names';
import * as watchingActions from '../../../ducks/watching';
import { displayBalance, toBaseUnits } from '../../../utils/balances';
import { showError, showSuccess } from '../../../ducks/notifications';
import Blocktime, { returnBlockTime } from '../../../components/Blocktime';
import Tooltipable from '../../../components/Tooltipable';
import * as logger from '../../../utils/logClient';
import '../domains.scss';
import '../add-to-calendar.scss';
import OpeningBid from './OpeningBid';
import OpenBid from './OpenBid';
import ReviewBid from './ReviewBid';
import PlacedBid from './PlacedBid';
import BidNow from './BidNow';
import Reveal from './Revealing';

@connect(
  (state) => ({
    network: state.node.network,
  })
)
class BidActionPanel extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    watchList: PropTypes.array.isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        name: PropTypes.string.isRequired
      })
    }),
  };

  // use ENUM instead of state and set state at next onclick -> maybe create a next step function with set state, and callback
  state = {
    isPlacingBid: false,
    shouldAddMask: false,
    isReviewing: false,
    hasAccepted: false,
    bidAmount: '',
    disguiseAmount: '',
    isLoading: false,
    successfullyBid: false,
    showSuccessModal: false,
    isWatching: false,
    event: {},
  };

  async componentWillMount() {
    await this.props.getWatching(this.props.network);
    const isWatching = this.props.watchList.includes(this.props.match.params.name)
    const event = await this.generateEvent();
    this.setState({ isWatching: isWatching, event: event || {} })

  }

  isOwned = () => {
    const { domain } = this.props;
    return domain && domain.isOwner;
  };

  isSold = () => isClosed(this.props.domain);

  render() {
    const name = this.props.match.params.name;
    const network = this.props.network;
    const isWatching = this.state.isWatching;
    return (
      <React.Fragment>
        {this.renderActionPanel()}
        <div className="domains__watch">
          <div className={c("domains__watch__heart-icon", {
            "domains__watch__heart-icon--active": this.state.isWatching
            })} onClick={() => {
              isWatching ? this.props.unwatchDomain(name, network) : this.props.watchDomain(name, network);
              this.setState({ isWatching: !isWatching })
            }}/>
          <div className="domains__watch__text">{this.state.isWatching ? 'Added to Watchlist' : 'Add to Watchlist'}</div>
        </div>
      </React.Fragment>
    )
  }

  renderActionPanel() {
    const {bidAmount, disguiseAmount, hasAccepted} = this.state;
    const { domain, sendOpen} = this.props;

    const { info } = domain || {};
    const {stats, bids = [], highest = 0} = info || {};
    const { bidPeriodEnd, hoursUntilReveal, revealPeriodEnd } = stats || {};

    if (this.state.isReviewing) {
      const lockup = Number(disguiseAmount) + Number(bidAmount);
      return (
      <ReviewBid
        lockup={lockup}
        bidAmount={bidAmount}
        disguiseAmount={disguiseAmount}
        hasAccepted={hasAccepted}
        editBid={() => this.setState({ isReviewing: false })}
        editDisguise={() => this.setState({ shouldAddMask: true, isReviewing: false })}
        onChange={e => this.setState({hasAccepted: e.target.checked})}
        onClick={
          () => this.handleCTA(
            () => this.props.sendBid(this.props.domain.name, bidAmount, lockup),
            null,
            'Failed to place bid. Please try again.',
            () => this.setState({
              isReviewing: false,
              isPlacingBid: false,
              successfullyBid: true,
              showSuccessModal: true,
            })
          )}
        />
      )
    }

    if (isOpening(domain)) {
      return <OpeningBid/>;
    }

    const ownBid = this.findOwnBid();
    if (isBidding(domain) || this.state.successfullyBid) {
      if (this.state.successfullyBid || ownBid || domain.pendingOperation === 'BID') {
        return (
          <PlacedBid onClose={() => this.setState({ showSuccessModal: false })}>
            {this.renderPlacedBidContent(ownBid)}
          </PlacedBid>
          )
      }
      return (
        <BidNow 
          timeRemaining={() => this.getTimeRemaining(hoursUntilReveal)}
          bids={bids}
          highest={highest}
        >
          {this.renderBidNowAction()}
        </BidNow>
        )
    }

    if (isReveal(domain)) {
      const ownReveal = this.findOwnReveal();
      const highestReveal = this.findHighestReveal;

      return (
        <Reveal ownReveal={ownReveal}>
          {this.renderInfoRow('Reveal Ends', <Blocktime height={revealPeriodEnd} fromNow />)}
          {ownReveal ? this.renderInfoRow('Your Reveal', displayBalance(ownReveal.value, true)) : null}
          {highestReveal ? this.renderInfoRow('Highest Reveal', displayBalance(highestReveal.value, true)) : null}
          {ownReveal ||!this.hasRevealableBid() ? null : this.renderRevealAction()}
        </Reveal>
      )
    }

    if (isAvailable(domain)) {
      return <OpenBid onClick={
        () => this.handleCTA(
          () => sendOpen(domain.name),
          'Successfully opened bid! Check back in a few minutes to start bidding.',
          'Failed to open bid. Please try again.',
        )
      }/>
    }

    return <noscript />;
  }

  async handleCTA(handler, successMessage, errorMessage, callback) {
    try {
      this.setState({ isLoading: true });
      await handler();
      if (successMessage) {
        this.props.showSuccess(successMessage);
      }
      // in case we want a callback rather than a successMessage
      if (callback){
        callback();
      }
    } catch (e) {
      console.error(e);
      logger.error(`Error received from BidActionPanel - handleCTA]\n\n${e.message}\n${e.stack}\n`);
      this.props.showError(errorMessage);
      return;
    } finally {
      this.setState({isLoading: false});
    }
  }

  renderPlacedBidContent(ownBid) {
    const domain = this.props.domain;
    const stats = domain.info && domain.info.stats || {};

    if (ownBid) {
      return (
        <React.Fragment>
          {this.renderInfoRow('Reveal', <Blocktime height={stats.bidPeriodEnd} fromNow />)}
          {/*{this.renderInfoRow('Reveal', this.getTimeRemaining(this.props.domain.info.stats.hoursUntilReveal))}*/}
          {this.renderInfoRow('Total Bids', this.props.domain.bids.length)}
          {this.renderInfoRow('Highest Mask', displayBalance(this.findHighestMaskBid(), true))}
          <div className="domains__bid-now-divider" />
          {this.renderInfoRow('Bid Amount', displayBalance(ownBid.value, true))}
          {this.renderInfoRow('Disguise Amount', displayBalance(ownBid.lockup, true))}
          {this.renderRevealPeriodBox()}
        </React.Fragment>
      );
    }

    return 'Your bid has been placed. Please wait a few minutes while the transaction confirms.';
  }

  getTimeRemaining(hoursUntilReveal) {
    if (!hoursUntilReveal) {
      return 'Revealing now!';
    }

    if (hoursUntilReveal < 24) {
      const hours = Math.floor(hoursUntilReveal % 24);
      const mins = Math.floor((hoursUntilReveal % 1) * 60);
      return `~${hours}h ${mins}m`
    }

    const days = Math.floor(hoursUntilReveal / 24);
    const hours = Math.floor(hoursUntilReveal % 24);
    const mins = Math.floor((hoursUntilReveal % 1) * 60);
    return `~${days}d ${hours}h ${mins}m`
  }

  renderMask() {
    const {shouldAddMask, disguiseAmount} = this.state;

    if (shouldAddMask) {
      return (
        <div className="domains__bid-now__form__row">
          <div className="domains__bid-now__form__row__label">
            <Tooltipable
              className="domains__bid-now__mask"
              tooltipContent={(
                <span className="domains__bid-now__mask-tooltip">
                  <span>You can disguise your bid amount to cover up your actual bid. Disguise gets added on top of your bid amount, resulting in your mask. The entire mask amount will be frozen during the bidding period. </span>
                  <span>The disguise amount will be returned after the reveal period, regardless of outcome.</span>
                </span>
              )}
            >
              Disguise
            </Tooltipable>
            <span> Amount:</span>
          </div>
          <div className="domains__bid-now__form__row__input">
            <input
              type="number"
              placeholder="Optional"
              onChange={e => this.setState({disguiseAmount: e.target.value})}
              value={disguiseAmount}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className="domains__bid-now__form__link"
        onClick={() => this.setState({shouldAddMask: true})}
      >
        Add Disguise
      </div>
    )
  }

  renderBidNowAction() {
    const {isPlacingBid, bidAmount, disguiseAmount} = this.state;
    const { confirmedBalance } = this.props;

    if (isPlacingBid) {
      return (
        <React.Fragment>
        <div className="domains__bid-now__action domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__form">
            <div className="domains__bid-now__form__row">
              <div className="domains__bid-now__form__row__label">Bid Amount:</div>
              <div className="domains__bid-now__form__row__input">
                <input
                  type="number"
                  placeholder="0.00"
                  onChange={e => this.setState({bidAmount: e.target.value})}
                  value={bidAmount}
                />
              </div>
            </div>
            {this.renderMask()}
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={() => this.setState({isReviewing: true})}
            disabled={!(bidAmount > 0)}
          >
            Review Bid
          </button>
        </div>
        <div className="domains__bid-now__action domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__HNS-status">
            {`${displayBalance(confirmedBalance)} HNS Unlocked Balance Available`}
          </div>
        </div>
        </React.Fragment>
      )
    }

    return (
      <div className="domains__bid-now__action">
        <button
          className="domains__bid-now__action__cta"
          onClick={() => this.setState({isPlacingBid: true})}
        >
          Place Bid
        </button>
      </div>
    );
  }

  renderRevealAction() {
    return (
      <div className="domains__bid-now__action">
        <button
          className="domains__bid-now__action__cta"
          onClick={() => this.handleCTA(
            () => this.props.sendReveal(this.props.domain.name),
            'Successfully revealed bid!',
            'Failed to reveal bid. Please try again.'
          )}
        >
          Reveal Your Bid
        </button>
      </div>
    )
  }

  renderInfoRow(label, value) {
    return (
      <div className="domains__bid-now__info">
        <div className="domains__bid-now__info__label">
          {label}:
        </div>
        <div className="domains__bid-now__info__value">
          {value}
        </div>
      </div>
    );
  }

  async generateEvent() {
    const name = this.props.match.params.name;
    const { domain, network } = this.props;
    const { networks } = protocol;
    const biddingPeriod = networks && networks[network].names.revealPeriod;
    const biddingPeriodInHours = biddingPeriod * 5 / 60;

    const { info } = domain || {};
    const { stats } = info || {};
    const { bidPeriodEnd } = stats || {};

    const startDatetime = await returnBlockTime(bidPeriodEnd, network);
    const endDatetime = startDatetime.clone().add(biddingPeriodInHours, 'hours');

    const event = {
      title: `Reveal of ${name}`,
      description: `The Handshake domain ${name} will be revealed at block ${bidPeriodEnd}. Check back into the Allison x Bob app to reveal the winner of the auction.`,
      location: 'The Decentralized Internet',
      startTime: startDatetime.format(),
      endTime: endDatetime.format(),
    };
    return event;
  }

  renderRevealPeriodBox() {
    const { domain } = this.props;
    const { info } = domain || {};
    const { stats } = info || {};
    const { bidPeriodEnd } = stats || {};

    let items = [
      { google: 'Google' },
      { apple: 'iCal' },
      { outlook: 'Outlook' },
   ];
    return (
      <div className="domains__bid-now__reveal">
        <div className="domains__bid-now__reveal__headline">
          Reveal Period
        </div>
        <div className="domains__bid-now__reveal__date"><Blocktime height={bidPeriodEnd} fromNow /></div>
        <div className="domains__bid-now__reveal__block">Block # {bidPeriodEnd}</div>
        <AddToCalendar
          event={this.state.event}
          listItems={items}
        />
      </div>
    )
  }

  findHighestMaskBid() {
    let highest = 0;
    for (const {bid} of this.props.domain.bids) {
      if (bid.lockup > highest) {
        highest = bid.lockup;
      }
    }
    return highest;
  }

  findHighestReveal() {
    let highest = 0;
    let highestReveal;
    for (const reveal of this.props.domain.reveals) {
      if (reveal.value > highest) {
        highest = reveal.value;
        highestReveal = reveal;
      }
    }

    return highestReveal;
  }

  hasRevealableBid() {
    for (const {bid, height} of this.props.domain.bids) {
      if (bid.own) {
        return height >= this.props.domain.info.height;
      }
    }

    return false;
  }

  findOwnBid() {
    for (const {bid, height} of this.props.domain.bids) {
      if (bid.own) {
        return bid;
      }
    }

    return null;
  }

  findOwnReveal() {
    if (this.props.domain.pendingOperation === 'REVEAL') {
      return this.props.domain.pendingOperationMeta.output;
    }

    for (const reveal of this.props.domain.reveals) {
      if (reveal.bid.own) {
        return reveal;
      }
    }

    return null;
  }
}

export default withRouter(
  connect(
    (state) => ({
      confirmedBalance: state.wallet.balance.confirmed,
      watchList: state.watching.names,
      network: state.node.network,
    }),
    dispatch => ({
      sendOpen: name => dispatch(nameActions.sendOpen(name)),
      sendBid: (name, amount, lockup) => dispatch(nameActions.sendBid(name, toBaseUnits(amount), toBaseUnits(lockup))),
      sendReveal: (name) => dispatch(nameActions.sendReveal(name)),
      showError: (message) => dispatch(showError(message)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      getWatching: (network) => dispatch(watchingActions.getWatching(network)),
      watchDomain: (name, network) => dispatch(watchingActions.addName(name, network)),
      unwatchDomain: (name, network) => dispatch(watchingActions.removeName(name, network)),
    }),
  )(BidActionPanel)
);
