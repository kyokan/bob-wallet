import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import { isReveal, isBidding, isOpening, isClosed } from '../../utils/name-helpers';
import { showError, showSuccess } from '../../ducks/notifications';

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
    const { domain } = this.props;
    return domain && domain.isOwner;
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
          onClick={e => {
            e.stopPropagation();
            history.push(`/domain_manager/${name}`)
          }}
        >
          <div className="bid-action__link">Manage</div>
        </div>
      );
    }

    if (this.isSold()) {
      const domain = this.props.domain || {};
      const reveals = domain.reveals || [];

      const hasOwnReveal = reveals.reduce((acc, reveal) => acc || reveal.own, false);
      return hasOwnReveal
        ? (
          <div
            className="bid-action"
            onClick={e => {
              e.stopPropagation();
              this.props.sendRedeem()
                .then(() => this.props.showSuccess('Your redeem request is submitted! Please wait about 15 minutes for it to complete.'))
                .catch(e => this.props.showError(e.message));
            }}
          >
            <div className="bid-action__link">Redeem</div>
          </div>
        )
        : <div className="bid-action" />;
    }

    return (
      <div className="bid-action" />
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
      sendRedeem: () => dispatch(nameActions.sendRedeem(ownProps.name)),
      showError: (message) => dispatch(showError(message)),
      showSuccess: (message) => dispatch(showSuccess(message)),
    }),
  )(BidAction)
);
