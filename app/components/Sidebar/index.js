import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import SendModal from '../SendModal';
import ReceiveModal from '../ReceiveModal';
import './sidebar.scss';

@withRouter
// @connect(
//   state => ({
//     initialized: state.wallet.initialized,
//     isLocked: state.wallet.isLocked,
//   }),
//   dispatch => ({
//     getNameInfo: tld => dispatch(domainActions.getNameInfo(tld)),
//   })
// )
class Sidebar extends Component {
  // static propTypes = {
  //   history: PropTypes.shape({
  //     push: PropTypes.func.isRequired,
  //   }).isRequired,
  //   location: PropTypes.shape({
  //     pathname: PropTypes.string.isRequired,
  //   }).isRequired,
  //   getNameInfo: PropTypes.func.isRequired,
  //   isLocked: PropTypes.bool.isRequired,
  //   initialized: PropTypes.bool.isRequired,
  // };

  render() {
    const name = c('sidebar', {
      // 'sidebar--empty': !this.props.initialized || this.props.isLocked
    });

    return (
      <div className={name}>
        <div className="sidebar__content">
          <div>
            <div className="sidebar__logo-wrapper">
              <div className="sidebar__logo-icon" />
              <div className="sidebar__logo-text">Allison x Bob</div>
            </div>
            {this.renderNav()}
          </div>
          {this.renderFooter()}
        </div>
      </div>
    );
  }

  renderNav() {
    // if (!this.props.initialized || this.props.isLocked) {
    //   return null;
    // }

    const {
      history: { push },
      location: { pathname }
    } = this.props;

    //use NavLink component check out docs
    return (
      <React.Fragment>
        <div className="sidebar__section">Wallet</div>
        <div className="sidebar__actions">
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /account/.test(pathname)
            })}
            onClick={() => push('/account')}
          >
            Portfolio
          </a>
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /send/.test(pathname)
            })}
            onClick={() => push('/send')}
          >
            Send
          </a>
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /receive/.test(pathname)
            })}
            onClick={() => push('/receive')}
          >
            Receive
          </a>
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /get_coins/.test(pathname)
            })}
            onClick={() => push('/get_coins')}
          >
            Name Manager
          </a>
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /settings/.test(pathname)
            })}
            onClick={() => console.log('push("/airdrop")')}
          >
            GooSig Airdrop
          </a>
        </div>
        <div className="sidebar__section">Top-Level Domains</div>
        <div className="sidebar__actions">
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /domains/.test(pathname)
            })}
            onClick={() => push('/domains')}
          >
            Browse Domains
          </a>
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /bids/.test(pathname)
            })}
            onClick={() => console.log('push("/bids")')}
          >
            Your Bids
          </a>
          <a
            className={c('sidebar__action', {
              'sidebar__action--selected': /watching/.test(pathname)
            })}
            onClick={() => console.log('push("/watching")')}
          >
            Watching
          </a>
        </div>
      </React.Fragment>
    );
  }

  renderFooter() {
    return (
      <div className="sidebar__footer">
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Height</div>
          <div className="sidebar__footer__text">2490</div>
        </div>
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Hash</div>
          <div className="sidebar__footer__text">1G8m3HUXrC...5GNn4xqX</div>
        </div>
      </div>
    );
  }
}

export default Sidebar;
