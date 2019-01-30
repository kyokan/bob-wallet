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
import * as logger from '../../../utils/logClient';
import OpenBid from './OpenBid';
import BidNow from './BidNow';
import Reveal from './Reveal';
import '../domains.scss';
import '../add-to-calendar.scss';

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

  state = {
    isPlacingBid: false,
    shouldAddDisguise: false,
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
    const { bidAmount, disguiseAmount, hasAccepted, showSuccessModal, isPlacingBid, shouldAddDisguise, isReviewing } = this.state;
    const { domain, sendOpen, confirmedBalance, currentBlock, network} = this.props;
    
    const name = this.props.match.params.name;
    const { info } = domain || {};
    const { stats, bids = [], highest = 0 } = info || {};
    const { bidPeriodEnd, hoursUntilReveal, revealPeriodEnd } = stats || {};

    const items = [
      { google: 'Google' },
      { apple: 'iCal' },
      { outlook: 'Outlook' },
    ];

    const ownBid = this.findOwnBid();
    if (isBidding(domain) || this.state.successfullyBid) {
      const lockup = Number(disguiseAmount) + Number(bidAmount);
      return (
        <BidNow 
          timeRemaining={() => this.getTimeRemaining(hoursUntilReveal)}
          hoursRemaining={hoursUntilReveal}
          confirmedBalance={confirmedBalance}
          bids={bids}
          ownBid={ownBid}
          highest={highest}
          isPlacingBid={isPlacingBid}
          disguiseAmount={disguiseAmount}
          bidAmount={bidAmount}
          isReviewing={isReviewing}
          shouldAddDisguise={shouldAddDisguise}
          successfullyBid={this.state.successfullyBid}
          showSuccessModal={showSuccessModal}
          bidPeriodEnd={bidPeriodEnd}
          hasAccepted={hasAccepted}
          lockup={lockup}
          items={items}
          name={name}
          network={network}
          isPending={domain.pendingOperation === 'BID'}
          editBid={() => this.setState({ isReviewing: false })}
          editDisguise={() => this.setState({ shouldAddDisguise: true, isReviewing: false })}
          displayBalance={`${displayBalance(confirmedBalance)} HNS Unlocked Balance Available`}
          onCloseModal={() => this.setState({ showSuccessModal: false })} 
          onChangeChecked={e => this.setState({hasAccepted: e.target.checked})}
          onChangeBidAmount={e => this.setState({bidAmount: e.target.value})}
          onChangeDisguiseAmount={e => this.setState({disguiseAmount: e.target.value})}
          onClickAddDisguise={() => this.setState({shouldAddDisguise: true})}
          onClickPlaceBid={() => this.setState({isPlacingBid: true})}
          onClickReview={() => this.setState({isReviewing: true})}
          onClickSendBid={
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

    if (isReveal(domain) || true) {
      const ownReveal = this.findOwnReveal();
      const highestReveal = this.findHighestReveal;

      return (
        <Reveal 
          isRevealing={isReveal(domain)}
          ownReveal={ownReveal}
          timeRemaining={() => this.getTimeRemaining(revealPeriodEnd)}
          hoursRemaining={revealPeriodEnd}
          bids={bids}
          highest={highest}
          event={this.state.event}
          items={items}
          name={name}
          hasRevealableBid={this.hasRevealableBid()}
          onClickRevealBids={() => this.handleCTA(
            () => this.props.sendReveal(this.props.domain.name),
            'Successfully revealed bid!',
            'Failed to reveal bid. Please try again.'
          )}
        />
      )
    }
    
    if (isAvailable(domain) || isOpening(domain)) {
      const { start } = domain || {};
      const isDomainOpening = isOpening(domain);

      return (
        <OpenBid
          isDomainOpening={isDomainOpening}
          startBlock={start.start}
          currentBlock={currentBlock}
          network={network}
          event={this.state.event}
          items={items}
          name={name}
          onClick={
            () => this.handleCTA(
              () => sendOpen(domain.name),
              'Successfully opened bid! Check back in a few minutes to start bidding.',
              'Failed to open bid. Please try again.',
            )
          }/>
      )
    }

    return <noscript />;
  }

  // Helper Functions
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
      currentBlock: state.node.chain.height,
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
