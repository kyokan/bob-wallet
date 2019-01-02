import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import cn from 'classnames';
import { connect } from 'react-redux';
import './domains.scss';
import * as names from '../../ducks/names';

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
  };

  render() {
    const { timeRemaining, totalBids, highestMask } = this.props;

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

  renderAction() {
    const { isPlacingBid, isReviewing, shouldAddMask } = this.state;

    if (isPlacingBid) {
      return (
        <div className="domains__bid-now__action domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__form">
            <div className="domains__bid-now__form__row">
              <div className="domains__bid-now__form__row__label">Bid Amount:</div>
              <div className="domains__bid-now__form__row__input">
                <input type="number" placeholder="0.00" />
              </div>
            </div>
            <div className="domains__bid-now__form__link">Add Mask</div>
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={() => this.setState({ isReviewing: true })}
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
