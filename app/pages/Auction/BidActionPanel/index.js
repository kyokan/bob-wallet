import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import c from 'classnames';
import { protocol } from 'hsd';
import { isAvailable, isBidding, isClosed, isOpening, isReveal } from '../../../utils/name-helpers';
import * as nameActions from '../../../ducks/names';
import * as watchingActions from '../../../ducks/watching';
import { displayBalance, toBaseUnits } from '../../../utils/balances';
import { showError, showSuccess } from '../../../ducks/notifications';
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
    this.setState({ isWatching: isWatching || {} })
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
    const { domain, confirmedBalance, network} = this.props;

    const name = this.props.match.params.name;
    const { info } = domain || {};
    const { stats, bids = [], highest = 0 } = info || {};
    const { bidPeriodEnd, hoursUntilReveal, revealPeriodEnd } = stats || {};

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

    if (isReveal(domain)) {
      return (
        <Reveal
          domain={domain}
          name={name}
        />
      )
    }

    if (isAvailable(domain) || isOpening(domain)) {
      return (
        <OpenBid
          domain={domain}
          name={name}
        />
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
