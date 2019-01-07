import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import { isReveal, isBidding, isOpening, isClosed } from '../../utils/name-helpers';
import { hoursToNow } from '../../utils/timeConverter';

class BidAction extends Component {
  static propTypes = {
    address: PropTypes.string.isRequired,
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

  isOwned = () => {
    const { address, domain } = this.props;
    return isClosed(domain) && domain.info.owner.hash === address;
  };
  isSold = () => isClosed(this.props.domain);

  render() {
    const { domain, history, name } = this.props;

    if (!domain) {
      return 'N/A';
    }

    const info = domain.info || {};
    const stats = info.stats || {};

    if (this.isBidding()) {
      return (
        <div className="bid-action">
          <div className="bid-action__link">Set Reminder</div>
        </div>
      );
    }

    if (this.isOpening()) {
      return (
        <div className="bid-action">
          <div className="bid-action__link">Set Reminder</div>
        </div>
      );
    }

    if (this.isReveal()) {
      return (
        <div className="bid-action">
          <div className="bid-action__link">Set Reminder</div>
        </div>
      );
    }

    if (this.isOwned()) {
      return (
        <div
          className="bid-action"
          onClick={() => history.push(`/domain/${name}`)}
        >
          <div className="bid-action__link">Manage</div>
        </div>
      );
    }

    return (
      <div className="bid-action">
        <div className="bid-action__delete-icon" />
      </div>
    );
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
  )(BidAction)
);
