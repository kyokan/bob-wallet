import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import { isReveal, isBidding, isOpening, isClosed } from '../../utils/nameHelpers';
import { showError, showSuccess } from '../../ducks/notifications';
import {I18nContext} from "../../utils/i18n";

class BidAction extends Component {
  static propTypes = {
    address: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
    getNameInfo: PropTypes.func.isRequired,
    sendRedeem: PropTypes.func.isRequired,
    sendRegister: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  componentDidMount() {
    const {
      name,
      getNameInfo,
    } = this.props;

    getNameInfo(name);
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
    const {t} = this.context;

    if (!domain) {
      return 'N/A';
    }

    const info = domain.info || {};
    const stats = info.stats || {};

    if (this.isOwned()) {
      return (
        <div className="bid-action">
          { this.renderRegister() }
          <div
            className="bid-action__link"
            onClick={e => {
              e.stopPropagation();
              history.push(`/domain_manager/${name}`)
            }}
          >
            {t('manage')}
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

  renderRegister() {
    const {
      name,
      sendRegister,
      showSuccess,
      showError,
    } = this.props;
    const {t} = this.context;
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
                sendRegister(name)
                  .then(() => showSuccess(t('registerSuccess')))
                  .catch(e => showError(e.message));
              }}
            >
              {t('register')}
            </div>
          );
        }
      }
    }
  }

  renderRedeem() {
    const domain = this.props.domain || {};
    const reveals = domain.reveals || [];
    const {t} = this.context;

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
                  .then(() => this.props.showSuccess(t('redeemSuccess')))
                  .catch(e => this.props.showError(e.message));
              }}
            >
              {t('redeem')}
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
        address: state.wallet.receiveAddress,
      };
    },
    (dispatch, ownProps) => ({
      sendRedeem: () => dispatch(nameActions.sendRedeem(ownProps.name)),
      sendRegister: () => dispatch(nameActions.sendRegister(ownProps.name)),
      showError: (message) => dispatch(showError(message)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      getNameInfo: (name) => dispatch(nameActions.getNameInfo(name)),
    }),
  )(BidAction)
);
