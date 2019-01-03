import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import cn from 'classnames';
import { connect } from 'react-redux';
import './domains.scss';
import * as names from '../../ducks/names';
import Checkbox from '../../components/Checkbox';

class BidNow extends Component {
  static propTypes = {
    // name: PropTypes.string.isRequired,
    timeRemaining: PropTypes.string.isRequired,
    highestMask: PropTypes.string.isRequired,
    totalBids: PropTypes.number.isRequired,
  };

  state = {
    isPlacingBid: false,
    shouldAddMask: false,
    isReviewing: false,
    bidAmount: '',
    maskAmount: '',
  };

  render() {
    const { timeRemaining, totalBids, highestMask } = this.props;

    if (this.state.isReviewing) {
      return this.renderReviewBid();
    }

    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Bid Now!</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Time Remaining:
            </div>
            <div className="domains__bid-now__info__time-remaining">
              {timeRemaining}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Total Bids:
            </div>
            <div className="domains__bid-now__info__value">
              {totalBids}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Highest <span>Mask</span>:
            </div>
            <div className="domains__bid-now__info__value">
              {highestMask}
            </div>
          </div>
        </div>
        { this.renderAction() }
      </div>
    );
  }

  renderReviewBid() {
    const { bidAmount, maskAmount } = this.state;
    return (
      <div className="domains__bid-now">
        <div className="domains__bid-now__title">Review Bid</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Bid Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {bidAmount}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Mask Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {maskAmount || '-'}
            </div>
          </div>
        </div>
        <div className="domains__bid-now__action">
          <div>
            <Checkbox />
            <div>I unnderstand my bid cannot be changed after I submit it.</div>
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

  renderAction() {
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
    (state, ownProps) => {
      const { name } = ownProps;
      const auctions = state.auctions[name] || {};
      // TODO use moment js to calculate time remaining
      const timeRemaining = '~5d 3h 33m';

      return {
        timeRemaining,
        totalBids: auctions.bids && auctions.bids.length,
        highestMask: `${auctions.highest || 0} HNS`,
      };
    },
  )(BidNow)
);
