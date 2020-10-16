import React, { Component } from 'react';
import { withRouter, NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import './sidebar.scss';
import ellipsify from '../../utils/ellipsify';
import { Logo } from '../Logo';

@withRouter
@connect(
  state => ({
    height: state.node.chain.height,
    tip: state.node.chain.tip,
    newBlockStatus: state.node.newBlockStatus,
    walletSync: state.wallet.walletSync,
    walletSyncProgress: state.wallet.walletSyncProgress,
  }),
  dispatch => ({})
)
class Sidebar extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }).isRequired,
    height: PropTypes.number.isRequired,
    tip: PropTypes.string.isRequired,
    newBlockStatus: PropTypes.string.isRequired,
    walletSync: PropTypes.bool.isRequired,
    walletSyncProgress: PropTypes.number.isRequired,
  };

  render() {
    return (
      <div className="sidebar">
        <div className="sidebar__content">
          <div>
            <div className="sidebar__logo-wrapper">
              <Logo />
            </div>
            {this.renderNav()}
          </div>
          {this.renderFooter()}
        </div>
      </div>
    );
  }

  renderNav() {
    const {
      history: { push },
      location: { pathname }
    } = this.props;
    return (
      <React.Fragment>
        <div className="sidebar__section">Wallet</div>
        <div className="sidebar__actions">
          <NavLink
            className="sidebar__action"
            to="/account"
            activeClassName="sidebar__action--selected"
          >
            Portfolio
          </NavLink>
          <NavLink
            className="sidebar__action"
            to="/send"
            activeClassName="sidebar__action--selected"
          >
            Send
          </NavLink>
          <NavLink
            className="sidebar__action"
            to="/receive"
            activeClassName="sidebar__action--selected"
          >
            Receive
          </NavLink>
          <NavLink
            className="sidebar__action"
            to="/domain_manager"
            activeClassName="sidebar__action--selected"
          >
            Domain Manager
          </NavLink>
          <NavLink
            className="sidebar__action"
            to="/get_coins"
            activeClassName="sidebar__action--selected"
          >
            Add Funds
          </NavLink>
        </div>
        <div className="sidebar__section">Top-Level Domains</div>
        <div className="sidebar__actions">
          <NavLink
            className="sidebar__action"
            to="/domains"
            activeClassName="sidebar__action--selected"
          >
            Browse Domains
          </NavLink>
          <NavLink
            className="sidebar__action"
            to="/bids"
            activeClassName="sidebar__action--selected"
          >
            Your Bids
          </NavLink>
          <NavLink
            className="sidebar__action"
            to="/watching"
            activeClassName="sidebar__action--selected"
          >
            Watching
          </NavLink>
        </div>
      </React.Fragment>
    );
  }

  renderFooter() {
    const {
      walletSync,
      walletSyncProgress,
    } = this.props;

    return (
      <div className="sidebar__footer">
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">{this.props.newBlockStatus}</div>
        </div>
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Height</div>
          <div className="sidebar__footer__text">
            {
              walletSync
                ? `${Math.floor((walletSyncProgress/100) * this.props.height)}/${this.props.height}`
                : this.props.height || '--'
            }
          </div>
        </div>
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Hash</div>
          <div className="sidebar__footer__text">
            {this.props.tip ? ellipsify(this.props.tip) : '--'}
          </div>
        </div>
      </div>
    );
  }
}

export default Sidebar;
