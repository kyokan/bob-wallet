import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import TLDInput from '../TLDInput';
import SyncStatus from '../SyncStatus';
import { Logo } from '../Logo';
import './topbar.scss';
import { displayBalance } from '../../utils/balances';
import { I18nContext } from "../../utils/i18n";
import * as walletActions from '../../ducks/walletActions';

@withRouter
@connect(
  state => {
    const {
      isRunning,
      isCustomRPCConnected,
    } = state.node;

    return {
      isRunning,
      isCustomRPCConnected,
      spendableBalance: state.wallet.balance.spendable,
      walletId: state.wallet.wid,
      walletWatchOnly: state.wallet.watchOnly,
      accountInfo: state.wallet.accountInfo,
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
    walletId: PropTypes.string.isRequired,
    getNameInfo: PropTypes.func.isRequired,
    lockWallet: PropTypes.func.isRequired,
    spendableBalance: PropTypes.number,
    walletWatchOnly: PropTypes.bool.isRequired,
    accountInfo: PropTypes.object.isRequired,
  };

  static contextType = I18nContext;

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
      showLogo,
      location: { pathname },
    } = this.props;

    return (
      <React.Fragment>
        {showLogo ? this.renderLogo() : this.renderTitle(title)}
        {!/domains$/.test(pathname) && <TLDInput minimalErrorDisplay />}
        <SyncStatus />
        { this.renderSettingIcon() }
      </React.Fragment>
    );
  }

  renderSettingIcon() {
    const {t} = this.context;

    const { spendableBalance, walletId } = this.props;
    const { isShowingSettingMenu } = this.state;
    const {watchOnly, type} = this.props.accountInfo;
    let walletName = walletId;
    if (watchOnly)
      walletName += ' (Ledger)';
    else if (type === 'multisig')
      walletName += ' (Multisig)';

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
                  {this.renderSettingGroup(t('walletID'), walletName)}
                  {this.renderSettingGroup(t('balanceSpendable'), `HNS ${displayBalance(spendableBalance)}`)}
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
                    {t('headingSettings')}
                  </div>
                  <div
                    className="setting-menu__items__item"
                    onClick={e => {
                      e.stopPropagation();
                      this.props.lockWallet();
                      this.setState({ isShowingSettingMenu: false });
                    }}
                  >
                    {t('logout')}
                  </div>
                </div>
              </div>
            )
            : null
        }
      </div>
    )
  }

  renderSettingGroup(label, content) {
    return (
      <div className="setting-menu__balance-container__item">
        <div className="setting-menu__balance-container__item__label">{label}</div>
        <div className="setting-menu__balance-container__item__amount">
          {content}
        </div>
      </div>
    )
  }
}

export default Topbar;
