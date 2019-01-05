import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import ReceiveModal from '../ReceiveModal';
import './sidebar.scss';
import ellipsify from '../../utils/ellipsify';
import Hash from '../Hash';

@withRouter
@connect(
  state => ({
    height: state.node.chain.height,
    tip: state.node.chain.tip
  }),
  dispatch => ({})
)
class Sidebar extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }).isRequired,
    isLocked: PropTypes.bool.isRequired,
    initialized: PropTypes.bool.isRequired,
    height: PropTypes.number.isRequired,
    tip: PropTypes.string.isRequired,
  };

  state = {
    isShowingReceiveModal: false,
  };

  toggleReceiveModal = (val) => this.setState({
    isShowingReceiveModal: val
  });

  render() {
    return (
      <div className="sidebar">
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
            onClick={() => this.toggleReceiveModal(true)}
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
        {this.state.isShowingReceiveModal ? <ReceiveModal onClose={() => this.toggleReceiveModal(false)} /> : null}
      </React.Fragment>
    );
  }

  renderFooter() {
    return (
      <div className="sidebar__footer">
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Height</div>
          <div className="sidebar__footer__text">{this.props.height || '--'}</div>
        </div>
        <div className="sidebar__footer__row">
          <div className="sidebar__footer__title">Current Hash</div>
          <div className="sidebar__footer__text">{this.props.tip ? ellipsify(this.props.tip) : '--'}</div>
        </div>
      </div>
    );
  }
}

export default Sidebar;
