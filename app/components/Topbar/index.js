import React, { Component } from 'react';
import { Link, withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import TLDInput from '../TLDInput';
import { Logo } from '../Logo';
import './topbar.scss';
import { displayBalance } from '../../utils/balances';
import * as walletActions from '../../ducks/walletActions';

@withRouter
@connect(
  state => {
    const { chain, isRunning } = state.node;
    const { progress } = chain || {};

    return {
      isSynchronizing: isRunning && progress < 1,
      isSynchronized: isRunning && progress === 1,
      progress,
      unconfirmedBalance: state.wallet.balance.unconfirmed,
      spendableBalance: state.wallet.balance.spendable,
    };
  },
  dispatch => ({
    getNameInfo: tld => dispatch(nameActions.getNameInfo(tld)),
    lockWallet: () => dispatch(walletActions.lockWallet()),
  })
)
class Topbar extends Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }).isRequired,
    getNameInfo: PropTypes.func.isRequired,
    isSynchronizing: PropTypes.bool.isRequired,
    isSynchronized: PropTypes.bool.isRequired,
    lockWallet: PropTypes.func.isRequired,
    unconfirmedBalance: PropTypes.number,
    spendableBalance: PropTypes.number,
  };

  state = {
    inputValue: '',
    isShowingSettingMenu: false,
  };

  render() {
    return (
      <div className="topbar">
        <div className="topbar__content">{this.renderNav()}</div>
      </div>
    );
  }

  handleInputValueChange = e => {
    const { value } = e.target;
    this.setState(() => ({
      inputValue: value.toLowerCase()
    }));
  };

  handleSearchClick = () => {
    const name = this.state.inputValue;

    if (!name.length) {
      return;
    }

    this.props.getNameInfo(name);
    this.props.history.push(`/domain/${name}`);
  };

  renderLogo() {
    const { history } = this.props;
    return (
      <div className="topbar__logoHeader">
        <div
          className="topbar__logoHeader__backArrow"
          onClick={() => history.goBack()}
        />
        <Logo onClick={() => history.push('/account')} />
      </div>
    );
  }

  renderTitle(title) {
    return <div className="topbar__title">{title}</div>;
  }

  renderNav() {
    const {
      title,
      isSynchronized,
      isSynchronizing,
      showLogo,
      location: { pathname }
    } = this.props;

    return (
      <React.Fragment>
        {showLogo ? this.renderLogo() : this.renderTitle(title)}
        {!/domains$/.test(pathname) && <TLDInput minimalErrorDisplay />}
        <div
          className={c('topbar__synced', {
            'topbar__synced--success': isSynchronized,
            'topbar__synced--failure': !isSynchronized && !isSynchronizing
          })}
        >
          {this.getSyncText()}
        </div>
        { this.renderSettingIcon() }
        {/*<Link to="/settings" className="topbar__icon topbar__icon--settings" />*/}
      </React.Fragment>
    );
  }

  renderSettingIcon() {
    const { unconfirmedBalance, spendableBalance } = this.props;
    const { isShowingSettingMenu } = this.state;
    return (
      <div
        className={c('topbar__icon', 'topbar__icon--settings', {
          'topbar__icon--settings--opened': this.state.isShowingSettingMenu,
        })}
        onClick={() => this.setState({ isShowingSettingMenu: !isShowingSettingMenu })}
      >
        {
          isShowingSettingMenu
            ? (
              <div className="setting-menu">
                <div className="setting-menu__balance-container">
                  <div className="setting-menu__balance-container__item">
                    <div className="setting-menu__balance-container__item__label">Total Balance</div>
                    <div className="setting-menu__balance-container__item__amount">
                      {`HNS ${displayBalance(unconfirmedBalance)}`}
                    </div>
                  </div>
                  <div className="setting-menu__balance-container__item">
                    <div className="setting-menu__balance-container__item__label">Spendable Balance</div>
                    <div className="setting-menu__balance-container__item__amount">
                      {`HNS ${displayBalance(spendableBalance)}`}
                    </div>
                  </div>
                </div>
                <div className="setting-menu__items">
                  <div
                    className="setting-menu__items__item"
                    onClick={e => {
                      e.stopPropagation();
                      this.props.history.push('/settings');
                      this.setState({ isShowingSettingMenu: false });
                    }}
                  >
                    Settings
                  </div>
                  <div
                    className="setting-menu__items__item"
                    onClick={e => {
                      e.stopPropagation();
                      this.props.lockWallet();
                      this.setState({ isShowingSettingMenu: false });
                    }}
                  >
                    Logout
                  </div>
                </div>
              </div>
            )
            : null
        }
      </div>
    )
  }

  getSyncText() {
    const { isSynchronized, isSynchronizing, progress } = this.props;

    if (isSynchronizing) {
      return `Synchronizing... ${
        progress ? '(' + (progress * 100).toFixed(2) + '%)' : ''
      }`;
    }

    if (isSynchronized) {
      return 'Synchronized';
    }

    return 'Not Synchronized';
  }
}

export default Topbar;
