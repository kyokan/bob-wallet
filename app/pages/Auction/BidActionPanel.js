import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import './domains.scss';
import {
  isAvailable,
  isOpening,
  isBidding,
} from '../../utils/name-helpers';
import Checkbox from '../../components/Checkbox';

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
  };

  render() {
    const { domain } = this.props;

    if (this.state.isReviewing) {
      return this.renderReviewBid();
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

  renderOpenBid() {
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Open Bid</div>
        <div className="domains__bid-now__content">
          Start the auction process by making an open bid.
        </div>
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={async () => {
              const resp = await fetch('http://127.0.0.1:15039', {
                method: 'POST',
                body: JSON.stringify({
                  method: 'sendopen',
                  params: [ this.props.domain.name ],
                }),
              });

              console.log(resp);
            }}
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

  // TODO: render placed bid
  renderPlacedBid() {
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Bid Placed!</div>
        <div className="domains__bid-now__content">
          To be updated
        </div>
      </div>
    );
  }

  getTimeRemaining(hoursUntilReveal) {
    if (!hoursUntilReveal) {
      return 'N/A';
    }

    if (hoursUntilReveal < 24) {
      const hours = Math.floor(hoursUntilReveal % 24);
      const mins = Math.floor((hoursUntilReveal % 1) * 60);
      return `~${hours}h ${mins}m`
    }

    const days = Math.floor(hoursUntilReveal / 24) ;
    const hours = Math.floor(hoursUntilReveal % 24);
    const mins = Math.floor((hoursUntilReveal % 1) * 60);
    return `~${days}d ${hours}h ${mins}m`
  }

  renderBidNow() {
    const { domain } = this.props;
    const { info } = domain || {};
    const { stats, bids = [], highest = 0 } = info || {};

    const { hoursUntilReveal } = stats || {};

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
        { this.renderBidNowAction() }
      </div>
    );
  }

  renderReviewBid() {
    const { bidAmount, maskAmount, hasAccepted } = this.state;
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
              onChange={e => this.setState({ hasAccepted: e.target.checked })}
              checked={hasAccepted}
            />
            <div className="domains__bid-now__action__agreement-text">
              I understand my bid cannot be changed after I submit it.
            </div>
          </div>
          <button
            className="domains__bid-now__action__cta"
          >
            Submit Bid
          </button>
        </div>
      </div>
    );
  }

  renderMask() {
    const { shouldAddMask, maskAmount } = this.state;

    if (shouldAddMask) {
      return (
        <div className="domains__bid-now__form__row">
          <div className="domains__bid-now__form__row__label">Mask Amount:</div>
          <div className="domains__bid-now__form__row__input">
            <input
              type="number"
              placeholder="Optional"
              onChange={e => this.setState({ maskAmount: e.target.value })}
              value={maskAmount}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className="domains__bid-now__form__link"
        onClick={() => this.setState({ shouldAddMask: true })}
      >
        Add Mask
      </div>
    )
  }

  renderBidNowAction() {
    const { isPlacingBid, bidAmount } = this.state;

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
                  onChange={e => this.setState({ bidAmount: e.target.value })}
                  value={bidAmount}
                />
              </div>
            </div>
            { this.renderMask() }
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={() => this.setState({ isReviewing: true })}
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
          onClick={() => this.setState({ isPlacingBid: true })}
        >
          Place Bid
        </button>
      </div>
    );
  }
}

export default withRouter(
  connect(

  )(BidActionPanel)
);
