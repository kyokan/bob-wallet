import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import { isAvailable, isBidding, isOpening, } from '../../utils/name-helpers';
import Checkbox from '../../components/Checkbox';
import * as nameActions from '../../ducks/names';
import './domains.scss';
import { displayBalance, toBaseUnits } from '../../utils/balances';
import { showError, showSuccess } from '../../ducks/notifications';

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
  };

  render() {
    const {domain} = this.props;

    if (this.state.isReviewing) {
      return this.renderReviewBid();
    }

    const ownBid = this.findOwnBid();
    if (ownBid) {
      return this.renderPlacedBid(ownBid)
    }

    if (isOpening(domain)) {
      return this.renderOpeningBid();
    }

    if (isBidding(domain)) {
      return this.renderBidNow();
    }

    if (isAvailable(domain)) {
      return this.renderOpenBid();
    }

    return <noscript />;
  }

  async handleCTA(handler, successMessage, errorMessage) {
    try {
      this.setState({isLoading: true});
      await handler();
    } catch (e) {
      console.error(e);
      this.props.showError(errorMessage);
      return;
    } finally {
      this.setState({isLoading: false});
    }

    this.props.showSuccess(successMessage);
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
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Bid Placed!</div>
        <div className="domains__bid-now__content">
          {this.renderInfoRow('Reveal', this.getTimeRemaining(this.props.domain.info.stats.hoursUntilReveal))}
          {this.renderInfoRow('Total Bids', this.props.domain.bids.length)}
          {this.renderInfoRow('Highest Mask', this.findHighestMask())}
          <div className="domains__bid-now-divider" />
          {this.renderInfoRow('Bid Amount', displayBalance(ownBid.value, true))}
          {this.renderInfoRow('Mask Amount', displayBalance(ownBid.lockup, true))}
          {this.renderRevealAction(ownBid)}
        </div>
      </div>
    );
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
        </div>
        {this.renderBidNowAction()}
      </div>
    );
  }

  renderReviewBid() {
    const {bidAmount, maskAmount, hasAccepted} = this.state;
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Review Bid</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Bid Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {`${bidAmount} HNS`}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Mask Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {maskAmount ? `${maskAmount} HNS` : ' - '}
            </div>
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
            onClick={() => {
              const {sendBid, domain} = this.props;
              sendBid(domain.name, bidAmount, maskAmount);
            }}
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

    if (isPlacingBid) {
      return (
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

  renderRevealAction(ownBid) {
    if (!ownBid) {
      return null;
    }

    return (
      <div className="domains__bid-now__action">
        <button
          className="domains__bid-now__action__cta"
          onClick={() => this.props.sendReveal(this.props.domain.name)}
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

  findHighestMask() {
    let highest = 0;
    for (const bid of this.props.domain.bids) {
      if (bid.lockup > highest) {
        highest = bid.lockup;
      }
    }

    return displayBalance(highest, true);
  }

  findOwnBid() {
    for (const bid of this.props.domain.bids) {
      if (bid.own) {
        return bid;
      }
    }

    return null;
  }
}

export default withRouter(
  connect(
    null,
    dispatch => ({
      sendOpen: name => dispatch(nameActions.sendOpen(name)),
      sendBid: (name, amount, lockup) => dispatch(nameActions.sendBid(name, toBaseUnits(amount), toBaseUnits(lockup))),
      sendReveal: (name) => dispatch(nameActions.sendReveal(name)),
      showError: (message) => dispatch(showError(message)),
      showSuccess: (message) => dispatch(showSuccess(message)),
    }),
  )(BidActionPanel)
);
