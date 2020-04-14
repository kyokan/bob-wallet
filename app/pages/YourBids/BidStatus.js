import React, { Component } from 'react';
import cn from 'classnames';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import {
  isReveal,
  isClosed,
  isBidding,
  isOpening,
  isAvailable,
} from '../../utils/nameHelpers';
import Hash from '../../components/Hash';
import Blocktime from '../../components/Blocktime';

class BidStatus extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
  };

  isSold = () => isClosed(this.props.domain);
  isReveal = () => isReveal(this.props.domain);
  isOwned = () => {
    const { domain } = this.props;
    return domain && domain.isOwner;
  };
  isBidding = () => isBidding(this.props.domain);
  isOpening = () => isOpening(this.props.domain);
  isAvailable = () => isAvailable(this.props.domain);

  getStatusClass() {
    let c = 'bid-status__dot';
    const { domain } = this.props;

    if (!domain) {
      return c;
    }

    if (this.isReveal()) {
      return `${c} ${c}--reveal`;
    }

    if (this.isOwned()) {
      return `${c} ${c}--owned`;
    }

    if (this.isSold()) {
      return `${c} ${c}--sold`;
    }

    if (this.isOpening()) {
      return `${c} ${c}--opening`;
    }

    if (this.isBidding()) {
      return `${c} ${c}--bidding`;
    }

    if (this.isAvailable()) {
      return `${c} ${c}--available`;
    }

    return `${c} ${c}--unavailable`;
  }

  render() {
    return (
      <div className="bid-status">
        <div className={this.getStatusClass()} />
        <div className="bid-status__text">
          {this.getStatusText()}
        </div>
      </div>
    )
  }

  getStatusText() {
    const { domain } = this.props;

    if (!domain) {
      return 'LOADING...';
    }

    if (this.isReveal()) {
      return 'REVEALING NOW';
    }

    if (this.isOwned()) {
      return 'WINNING BID';
    }

    if (this.isSold()) {
      return (
        <span>
          <span>SOLD</span>
          <span className="bid-status__text__paren">
            <span>(</span>
            <span className="bid-status__text__link">
              <Hash value={domain.winner.address} start={4} end={-4} />
            </span>
            <span>)</span>
          </span>
        </span>
      );
    }

    if (this.isOpening()) {
      return 'OPENING NOW';
    }

    if (this.isBidding()) {
      const { bids } = domain;

      return (
        <span>
          <span>BIDDING NOW</span>
          <span className="bid-status__text__paren">
            <span>(</span>
            <span className="bid-status__text__link">
              {`${bids ? bids.length : '0'} bids`}
            </span>
            <span>)</span>
          </span>
        </span>
      );
    }

    if (this.isAvailable()) {
      return (
        <span>
          <span>AVAILABLE ON</span>
          <span className="bid-status__text__paren">
            <Blocktime height={domain.start.start} />
          </span>
        </span>
      )
    }

    return "UNAVAILABLE";

  }
}

export default withRouter(
  connect(
    (state, ownProps) => {
      const name = state.names[ownProps.name];

      return {
        domain: name,
        address: state.wallet.address,
      };
    }
  )(BidStatus)
);
