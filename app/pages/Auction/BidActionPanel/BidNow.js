import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  AuctionPanel,
  AuctionPanelFooter,
  AuctionPanelHeader,
  AuctionPanelHeaderRow,
} from '../../../components/AuctionPanel';
import Tooltipable from '../../../components/Tooltipable';
import SuccessModal from '../../../components/SuccessModal';
import Checkbox from '../../../components/Checkbox';
import * as nameActions from '../../../ducks/names';
import { showError, showSuccess } from '../../../ducks/notifications';
import { displayBalance, toBaseUnits } from '../../../utils/balances';
import * as logger from '../../../utils/logClient';
import { clientStub as aClientStub } from '../../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

class BidNow extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    totalBids: PropTypes.number.isRequired,
    totalMasks: PropTypes.number.isRequired,
    ownHighestBid: PropTypes.object.isRequired,
    isPending: PropTypes.bool.isRequired,
    confirmedBalance: PropTypes.number.isRequired,
  };

  state = {
    isPlacingBid: false,
    shouldAddDisguise: false,
    isReviewing: false,
    hasAccepted: false,
    bidAmount: '',
    disguiseAmount: '',
    successfullyBid: false,
    showSuccessModal: false,
  };

  getTimeRemaining = () => {
    const {info} = this.props.domain || {};
    const {stats} = info || {};
    const {hoursUntilReveal} = stats || {};

    if (hoursUntilReveal < 24) {
      const hours = Math.floor(hoursUntilReveal % 24);
      const mins = Math.floor((hoursUntilReveal % 1) * 60);
      return `~${hours}h ${mins}m`;
    }

    const days = Math.floor(hoursUntilReveal / 24);
    const hours = Math.floor(hoursUntilReveal % 24);
    const mins = Math.floor((hoursUntilReveal % 1) * 60);
    return `~${days}d ${hours}h ${mins}m`;
  };

  sendBid = async () => {
    const {sendBid} = this.props;
    const {bidAmount, disguiseAmount} = this.state;
    const lockup = Number(disguiseAmount) + Number(bidAmount);

    try {
      await sendBid(bidAmount, lockup);
      this.setState({
        isReviewing: false,
        isPlacingBid: false,
        successfullyBid: true,
        showSuccessModal: true,
      });
      analytics.track('sent bid');
    } catch (e) {
      console.error(e);
      logger.error(`Error received from BidNow - sendBid]\n\n${e.message}\n${e.stack}\n`);
      this.props.showError('Failed to place bid. Please try again.');
    }
  };

  render() {
    const {domain} = this.props;

    const {
      bidAmount,
      disguiseAmount,
      showSuccessModal,
      isPlacingBid,
    } = this.state;

    const {bids = [], info} = domain || {};
    const {highest = 0, stats} = info || {};
    const {bidPeriodEnd} = stats || {};

    return (
      <AuctionPanel>
        {
          showSuccessModal && (
            <SuccessModal
              bidAmount={bidAmount}
              maskAmount={Number(bidAmount) + Number(disguiseAmount)}
              revealStartBlock={bidPeriodEnd}
              onClose={() => this.setState({showSuccessModal: false})}
            />
          )
        }
        <AuctionPanelHeader title="Auction Details">
          <AuctionPanelHeaderRow label="Reveal Ends:">
            <div className="domains__bid-now__info__time-remaining">
              <div>
                {this.getTimeRemaining()}
              </div>
            </div>
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Total Bids:">
            {bids.length}
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Highest Mask:">
            {highest}
          </AuctionPanelHeaderRow>
          <div className="domains__bid-now__info__disclaimer">
            <Tooltipable
              tooltipContent={'To prevent price sniping, Handshake uses a blind second-price auction called a Vickrey Auction. Users can buy and register top-level domains (TLDs) with Handshake coins (HNS).'}>
              <div className="domains__bid-now__info__icon" />
            </Tooltipable>
            Winner pays 2nd highest bid price.
          </div>
        </AuctionPanelHeader>
        {isPlacingBid ? this.renderBidNow() : this.renderOwnBidAction()}
      </AuctionPanel>
    );
  }

  renderBiddingView() {
    const {
      bidAmount,
    } = this.state;

    const {confirmedBalance} = this.props;

    return (
      <AuctionPanelFooter>
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
      </AuctionPanelFooter>
    );
  }

  renderMask() {
    const {
      shouldAddDisguise,
      disguiseAmount,
    } = this.state;

    if (shouldAddDisguise) {
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
        onClick={() => this.setState({shouldAddDisguise: true})}
      >
        Add Disguise
      </div>
    );
  }

  renderOwnHighestBid() {
    const {ownHighestBid, totalBids, totalMasks} = this.props;

    if (ownHighestBid) {
      return (
        <div className="domains__bid-now__own-highest-bid">
          <div className="domains__bid-now__own-highest-bid__title">Your Highest Bid</div>
          <div className="domains__bid-now__content">
            <AuctionPanelHeaderRow label="Total Bids:">
              {displayBalance(totalBids, true)}
            </AuctionPanelHeaderRow>
            <AuctionPanelHeaderRow label="Total Masks:">
              {displayBalance(totalMasks, true)}
            </AuctionPanelHeaderRow>
          </div>
        </div>
      );
    }
  }

  renderOwnBidAction() {
    return (
      <AuctionPanelFooter>
        {this.renderOwnHighestBid()}
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={() => this.setState({isPlacingBid: true})}
            disabled={this.isBidPending()}
          >
            {this.isBidPending() ? 'Bid Pending...' : 'Place Bid'}
          </button>
        </div>
      </AuctionPanelFooter>
    );
  }

  renderReviewing() {
    const {
      bidAmount,
      disguiseAmount,
      hasAccepted,
    } = this.state;

    return (
      <AuctionPanelFooter>
        <div className="domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__title">Review Your Bid</div>
          <div className="domains__bid-now__content">
            <AuctionPanelHeaderRow label="Bid Amount:">
              <div className="domains__bid-now__review-info">
                <div className="domains__bid-now__info__value">
                  {`${bidAmount} HNS`}
                </div>
                <div
                  className="domains__bid-now__action__edit-icon"
                  onClick={() => this.setState({isReviewing: false})}
                />
              </div>
            </AuctionPanelHeaderRow>
            <AuctionPanelHeaderRow label="Disguise Amount:">
              <div className="domains__bid-now__review-info">
                <div className="domains__bid-now__info__value">
                  {disguiseAmount ? `${disguiseAmount} HNS` : ' - '}
                </div>
                <div
                  className="domains__bid-now__action__edit-icon"
                  onClick={() => this.setState({
                    isReviewing: false,
                    shouldAddDisguise: true,
                  })}
                />
              </div>
            </AuctionPanelHeaderRow>
            <div className="domains__bid-now__divider" />
            <AuctionPanelHeaderRow
              label="Total Mask:"
              className="domains__bid-now__review-total"
            >
              <div className="domains__bid-now__info__value">
                {`${Number(disguiseAmount) + Number(bidAmount)} HNS`}
              </div>
            </AuctionPanelHeaderRow>
          </div>
          <div className="domains__bid-now__action">
            <div className="domains__bid-now__action__agreement">
              <Checkbox
                onChange={e => this.setState({hasAccepted: e.target.checked})}
                checked={hasAccepted}
              />
              <div className="domains__bid-now__action__agreement-text">
                I understand my bid cannot be changed after I submit it.
              </div>
            </div>
            <button
              className="domains__bid-now__action__cta"
              onClick={this.sendBid}
              disabled={!hasAccepted}
            >
              Submit Bid
            </button>
          </div>
        </div>
      </AuctionPanelFooter>
    );
  }

  isBidPending() {
    const {successfullyBid} = this.state;
    return successfullyBid || this.props.isPending;
  }

  renderBidNow() {
    const {isReviewing} = this.state;
    return isReviewing ? this.renderReviewing() : this.renderBiddingView();
  }
}

export default connect(
  (state, {domain}) => ({
    confirmedBalance: state.wallet.balance.confirmed,
    ownHighestBid: _ownHighestBid(domain),
    totalBids: getTotalBids(domain),
    totalMasks: getTotalMasks(domain),
    network: state.node.network,
    isPending: domain.pendingOperation === 'BID',
  }),
  (dispatch, {name}) => ({
    sendBid: (amount, lockup) => dispatch(nameActions.sendBid(name, toBaseUnits(amount), toBaseUnits(lockup))),
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)(BidNow);

function getTotalBids(domain) {
  let total = 0;

  for (const {bid} of domain.bids) {
    if (bid.own) {
      total += bid.value;
    }
  }

  return total;
}

function getTotalMasks(domain) {
  let total = 0;

  for (const {bid} of domain.bids) {
    if (bid.own) {
      total += bid.lockup;
    }
  }

  return total;
}

function _ownHighestBid(domain) {
  let highestBid = null;

  for (const {bid} of domain.bids) {
    if (bid.own) {
      if (!highestBid) {
        highestBid = bid;
      } else {
        highestBid = bid.value > highestBid.value ? bid : highestBid;
      }
    }
  }

  return highestBid;
}
