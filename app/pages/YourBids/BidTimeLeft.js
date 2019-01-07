import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import { isReveal, isBidding, isOpening } from '../../utils/name-helpers';
import { hoursToNow } from '../../utils/timeConverter';

class BidStatus extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    getNameInfo: PropTypes.func.isRequired,
    domain: PropTypes.object,
  };

  componentWillMount() {
    this.props.getNameInfo();
  }

  isReveal = () => isReveal(this.props.domain);

  isBidding = () => isBidding(this.props.domain);

  isOpening = () => isOpening(this.props.domain);

  render() {
    const info = this.props.domain.info || {};
    const stats = info.stats || {};

    if (this.isBidding()) {
      return hoursToNow(stats.hoursUntilBidding);
    }

    if (this.isOpening()) {
      return hoursToNow(stats.hoursUntilReveal);
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
    },
    (dispatch, ownProps) => ({
      getNameInfo: () => dispatch(nameActions.getNameInfo(ownProps.name)),
    }),
  )(BidStatus)
);
