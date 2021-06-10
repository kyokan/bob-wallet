import React, { Component } from 'react';
import { withRouter, NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import './sidebar.scss';
import ellipsify from '../../utils/ellipsify';
import { Logo } from '../Logo';
import {clientStub} from "../../background/node/client";
import {NETWORKS} from "../../constants/networks";
const nodeClient = clientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  state => ({
    network: state.node.network,
    chainHeight: state.node.chain.height,
    tip: state.node.chain.tip,
    newBlockStatus: state.node.newBlockStatus,
    walletId: state.wallet.wid,
    walletWatchOnly: state.wallet.watchOnly,
    walletSync: state.wallet.walletSync,
    walletHeight: state.wallet.walletHeight,
    address: state.wallet.address,
  }),
  dispatch => ({

  }),
)
class Sidebar extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }).isRequired,
    chainHeight: PropTypes.number.isRequired,
    walletId: PropTypes.string.isRequired,
    tip: PropTypes.string.isRequired,
    newBlockStatus: PropTypes.string.isRequired,
    walletWatchOnly: PropTypes.bool.isRequired,
    walletSync: PropTypes.bool.isRequired,
    walletHeight: PropTypes.number.isRequired,
    network: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
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
    const title = this.props.walletWatchOnly
      ? `Ledger Wallet (${this.props.walletId})`
      : `Wallet (${this.props.walletId})`;
    return (
      <React.Fragment>
        <div className="sidebar__section">{title}</div>
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
          <NavLink
            className="sidebar__action"
            to="/exchange"
            activeClassName="sidebar__action--selected"
          >
            Exchange
          </NavLink>
        </div>
      </React.Fragment>
    );
  }

  renderGenerateBlockButton(numblocks) {
    const { network, address } = this.props;
    if ([NETWORKS.SIMNET, NETWORKS.REGTEST].includes(network)) {
      return (
        <button
          className="sidebar__generate-btn"
          onClick={() => nodeClient.generateToAddress(numblocks, address)}
        >
         {`+${numblocks}`}
        </button>
      )
    }
  }

  renderFooter() {
    const {
      walletSync,
      walletHeight,
      newBlockStatus,
      chainHeight,
      tip,
    } = this.props;

    return (
      <div className="sidebar__footer">
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">{newBlockStatus}</div>
        </div>
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Height</div>
          <div className="sidebar__footer__text">
            {walletSync ? `${walletHeight}/${chainHeight}` : `${chainHeight}` || '--'}
          </div>
          <div className="sidebar__footer__simnet-controls">
            {this.renderGenerateBlockButton(1)}
            {this.renderGenerateBlockButton(10)}
            {this.renderGenerateBlockButton(50)}
          </div>
        </div>
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Hash</div>
          <div className="sidebar__footer__text">
            {tip ? ellipsify(tip) : '--'}
          </div>
        </div>
      </div>
    );
  }
}

export default Sidebar;
