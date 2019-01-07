import React, { Component } from 'react';
import cn from 'classnames';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import { isReveal, isClosed, isBidding, isOpening } from '../../utils/name-helpers';
import Hash from '../../components/Hash';

class BidStatus extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    getNameInfo: PropTypes.func.isRequired,
  };

  componentWillMount() {
    this.props.getNameInfo();
  }

  isSold = () => isClosed(this.props.domain);
  isReveal = () => isReveal(this.props.domain);
  isOwned = () => {
    const { address, domain } = this.props;
    return isClosed(domain) && domain.info.owner.hash === address;
  };
  isBidding = () => isOpening(this.props.domain) || isBidding(this.props.domain);

  render() {
    return (
      <div className="bid-status">
        <div
          className={cn('bid-status__dot', {
            'bid-status__dot--sold': this.isSold(),
            'bid-status__dot--owned': this.isOwned(),
          })}
        />
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
              <Hash value={domain.info.owner.hash} start={4} end={-4} />
            </span>
            <span>)</span>
          </span>
        </span>
      );
    }

    if (this.isBidding()) {
      const { bids } = domain.info;

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
      getNameInfo: () => dispatch(nameActions.getNameInfo(ownProps.name)),
    }),
  )(BidStatus)
);
