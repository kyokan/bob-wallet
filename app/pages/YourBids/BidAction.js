import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import { isReveal, isBidding, isOpening, isClosed } from '../../utils/nameHelpers';
import { showError, showSuccess } from '../../ducks/notifications';

class BidAction extends Component {
  static propTypes = {
    address: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
  };

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
        <div className="bid-action">
          { this.renderRedeem() }
          <div
            className="bid-action__link"
            onClick={e => {
              e.stopPropagation();
              history.push(`/domain_manager/${name}`)
            }}
          >
            Manage
          </div>
        </div>
      );
    }

    if (this.isSold()) {
      return (
        <div className="bid-action">
          { this.renderRedeem() }
        </div>
      );
    }

    return (
      <div className="bid-action" />
    );
  }

  renderRedeem() {
    const domain = this.props.domain || {};
    const reveals = domain.reveals || [];

    for (let i = 0; i < reveals.length; i++) {
      const reveal = reveals[i];
      if (reveal.bid.own && reveal.height >= domain.info.height) {
        if (reveal.redeemable) {
          return (
            <div
              className="bid-action__link"
              onClick={e => {
                e.stopPropagation();
                this.props.sendRedeem()
                  .then(() => this.props.showSuccess('Your redeem request is submitted! Please wait about 15 minutes for it to complete.'))
                  .catch(e => this.props.showError(e.message));
              }}
            >
              Redeem
            </div>
          );
        }
      }
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
      sendRedeem: () => dispatch(nameActions.sendRedeem(ownProps.name)),
      showError: (message) => dispatch(showError(message)),
      showSuccess: (message) => dispatch(showSuccess(message)),
    }),
  )(BidAction)
);
