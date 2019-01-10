import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import { isAvailable, isBidding, isOpening, isReveal, } from '../../utils/name-helpers';
import Checkbox from '../../components/Checkbox';
import * as nameActions from '../../ducks/names';
import './domains.scss';
import { displayBalance, toBaseUnits } from '../../utils/balances';
import { showError, showSuccess } from '../../ducks/notifications';
import Blocktime from '../../components/Blocktime';
import SuccessModal from "../../components/SuccessModal";

class BidActionPanel extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
  };

  state = {
    isPlacingBid: false,
    shouldAddMask: false,
    isReviewing: false,
    hasAccepted: false,
    bidAmount: '',
    maskAmount: '',
    isLoading: false,
    successfullyBid: false,
    showSuccessModal: false,
  };

  render() {
    const { domain } = this.props;

    if (this.state.isReviewing) {
      return this.renderReviewBid();
    }
    
    if (isOpening(domain)) {
      return this.renderOpeningBid();
    }
    
    const ownBid = this.findOwnBid();
    if (isBidding(domain) || this.state.successfullyBid) {
      if (this.state.successfullyBid || ownBid || domain.pendingOperation === 'BID') {
        return this.renderPlacedBid(ownBid)
      }
      return this.renderBidNow();
    }

    if (isAvailable(domain)) {
      return this.renderOpenBid();
    }

    if (isReveal(domain)) {
      return this.renderRevealing(ownBid);
    }

    return <noscript />;
  }

  async handleCTA(handler, successMessage, errorMessage, callback) {
    try {
      this.setState({ isLoading: true });
      await handler();
    } catch (e) {
      console.error(e);
      this.props.showError(errorMessage);
      return;
    } finally {
      this.setState({isLoading: false});
      if (callback){
        callback();
      }
    }
    if (successMessage) {
      this.props.showSuccess(successMessage);
    }
  }

  renderOpenBid() {
    const {domain, sendOpen} = this.props;
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Open Bid</div>
        <div className="domains__bid-now__content">
          Start the auction process by making an open bid.
        </div>
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={
              () => this.handleCTA(
                () => sendOpen(domain.name),
                'Successfully opened bid! Check back in a few minutes to start bidding.',
                'Failed to open bid. Please try again.',
              )
            }
          >
            Open Bid
          </button>
        </div>
      </div>
    );
  }

  renderOpeningBid() {
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Bid is opening!</div>
        <div className="domains__bid-now__content">
          The auction will start soon. Please check back shortly to place your bid.
        </div>
      </div>
    );
  }

  renderPlacedBid(ownBid) {
    const { showSuccessModal, bidAmount, maskAmount } = this.state;

    return (
      <div className="domains__bid-now">
        {showSuccessModal && 
          <SuccessModal 
            bidAmount={bidAmount} 
            maskAmount={maskAmount} 
            onClose={() => this.setState({ showSuccessModal: false })}
          />}
        <div className="domains__bid-now__title">Bid placed!</div>
        <div className="domains__bid-now__content">
          {this.renderPlacedBidContent(ownBid)}
        </div>
      </div>
    );
  }

  renderPlacedBidContent(ownBid) {
    if (ownBid) {
      return (
        <React.Fragment>
          {this.renderInfoRow('Reveal', this.getTimeRemaining(this.props.domain.info.stats.hoursUntilReveal))}
          {this.renderInfoRow('Total Bids', this.props.domain.bids.length)}
          {this.renderInfoRow('Highest Mask', displayBalance(this.findHighestMaskBid(), true))}
          <div className="domains__bid-now-divider" />
          {this.renderInfoRow('Bid Amount', displayBalance(ownBid.value, true))}
          {this.renderInfoRow('Mask Amount', displayBalance(ownBid.lockup, true))}
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

  renderBidNow() {
    const {domain} = this.props;
    const {info} = domain || {};
    const {stats, bids = [], highest = 0} = info || {};

    const {hoursUntilReveal} = stats || {};

    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Bid Now!</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Time Remaining:
            </div>
            <div className="domains__bid-now__info__time-remaining">
              {this.getTimeRemaining(hoursUntilReveal)}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Total Bids:
            </div>
            <div className="domains__bid-now__info__value">
              {bids.length}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Highest <span>Mask</span>:
            </div>
            <div className="domains__bid-now__info__value">
              {highest}
            </div>
          </div>
          <div className="domains__bid-now__info__disclaimer">
            Winner pays 2nd highest bid price.
          </div>
        </div>
        {this.renderBidNowAction()}
      </div>
    );
  }

  renderReviewBid() {
    const {bidAmount, maskAmount, hasAccepted} = this.state;
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Review Your Bid</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Bid Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {`${bidAmount} HNS`}
            </div>
            <div className="domains__bid-now__action__edit-icon" 
              onClick={() => this.setState({ isReviewing: false }) } 
            />
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Mask Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {maskAmount ? `${maskAmount} HNS` : ' - '}
            </div>
            <div className="domains__bid-now__action__edit-icon" 
              onClick={() => this.setState({ isReviewing: false }) } 
            />
          </div>
          <div className="domains__bid-now__divider" />
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Total Lockup
            </div>
            <div className="domains__bid-now__info__value">
              {`${bidAmount + maskAmount} HNS`}
            </div>
            <div className="domains__bid-now__action__placeholder" />
          </div>
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
            onClick={
              () => this.handleCTA(
                () => {
                  const lockup = bidAmount + maskAmount;
                  this.props.sendBid(this.props.domain.name, bidAmount, lockup)
                },
                null,
                'Failed to place bid. Please try again.',
                () => this.setState({ 
                  isReviewing: false, 
                  isPlacingBid: false, 
                  successfullyBid: true, 
                  showSuccessModal: true,
                })
              )
            //   () => this.handleCTA(
            //   () => this.props.sendBid(this.props.domain.name, bidAmount, maskAmount),
            //   'Bid successfully placed!',
            //   'Failed to place bid. Please try again.'
            // )
          }
          >
            Submit Bid
          </button>
        </div>
      </div>
    );
  }

  renderMask() {
    const {shouldAddMask, maskAmount} = this.state;

    if (shouldAddMask) {
      return (
        <div className="domains__bid-now__form__row">
          <div className="domains__bid-now__form__row__label">Mask Amount:</div>
          <div className="domains__bid-now__form__row__input">
            <input
              type="number"
              placeholder="Optional"
              onChange={e => this.setState({maskAmount: e.target.value})}
              value={maskAmount}
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
        Add Mask
      </div>
    )
  }

  renderBidNowAction() {
    const {isPlacingBid, bidAmount} = this.state;
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
            disabled={!bidAmount}
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

  renderRevealing(ownBid) {
    const ownReveal = this.findOwnReveal();
    const highestReveal = this.findHighestReveal();
    const domain = this.props.domain;
    const stats = domain.info && domain.info.stats || {};

    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">{ownReveal ? 'Bid revealed.' : 'Revealing'}</div>
        <div className="domains__bid-now__content">
          {this.renderInfoRow('Reveal Ends', <Blocktime height={stats.revealPeriodEnd} fromNow />)}
          {ownReveal ? this.renderInfoRow('Your Reveal', displayBalance(ownReveal.value, true)) : null}
          {highestReveal ? this.renderInfoRow('Highest Reveal', displayBalance(highestReveal.value, true)) : null}
          {ownReveal ||!ownBid ? null : this.renderRevealAction()}
        </div>
      </div>
    );
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

  findOwnBid() {
    for (const {bid} of this.props.domain.bids) {
      if (bid.own) {
        return bid;
      }
    }

    return null;
  }

  findOwnReveal() {
    for (const reveal of this.props.domain.reveals) {
      if (reveal.own) {
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
    }),
    dispatch => ({
      sendOpen: name => dispatch(nameActions.sendOpen(name)),
      sendBid: (name, amount, lockup) => dispatch(nameActions.sendBid(name, toBaseUnits(amount), toBaseUnits(lockup))),
      sendReveal: (name) => dispatch(nameActions.sendReveal(name)),
      showError: (message) => dispatch(showError(message)),
      showSuccess: (message) => dispatch(showSuccess(message)),
    }),
  )(BidActionPanel)
);
