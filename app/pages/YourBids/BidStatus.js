import React, { Component } from 'react';
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
import Blocktime from '../../components/Blocktime';
import * as namesActions from "../../ducks/names";


class BidStatus extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
    address: PropTypes.string.isRequired,
    fetchName: PropTypes.func.isRequired,
  };

  componentDidMount() {
    if (!this.props.domain) {
      this.props.fetchName();
    }
  }

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
      return 'SOLD';
    }

    if (this.isOpening()) {
      return 'OPENING NOW';
    }

    if (this.isBidding()) {
      const { bids } = domain;
      const bidLength = bids.length || 0;
      let bidText = '';

      if (bidLength === 1)
        bidText = `${bidLength} bid`;
      else
        bidText = `${bidLength} bids`;

      return (
        <span>
          <span>BIDDING NOW</span>
          <span className="bid-status__text__paren">
            <span>(</span>
            <span className="bid-status__text__link">{bidText}</span>
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
    },
    (dispatch, ownProps) => ({
      fetchName: () => dispatch(namesActions.fetchName(ownProps.name)),
    }),
  )(BidStatus)
);
