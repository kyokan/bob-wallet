import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import { isReveal, isBidding, isOpening } from '../../utils/nameHelpers';
import { hoursToNow } from '../../utils/timeConverter';

class BidTimeLeft extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
  };

  isReveal = () => isReveal(this.props.domain);

  isBidding = () => isBidding(this.props.domain);

  isOpening = () => isOpening(this.props.domain);

  render() {
    const { domain } = this.props;

    if (!domain) {
      return 'N/A';
    }

    const info = domain.info || {};
    const stats = info.stats || {};

    if (this.isBidding()) {
      return hoursToNow(stats.hoursUntilReveal);
    }

    if (this.isOpening()) {
      return hoursToNow(stats.hoursUntilBidding);
    }

    if (this.isReveal()) {
      return hoursToNow(stats.hoursUntilClose);
    }

    return 'N/A';
  }
}

export default withRouter(
  connect(
    (state, ownProps) => {
      const name = state.names[ownProps.name];

      return {
        domain: name,
      };
    }
  )(BidTimeLeft)
);
