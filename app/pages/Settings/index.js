import React, { Component } from 'react';
import { Route, Switch, Link } from 'react-router-dom';
import { ContentArea } from '../ContentArea';
import { connect } from 'react-redux';
import Dropdown from '../../components/Dropdown';
import './index.scss';
import AccountIndexModal from './AccountIndexModal';
import RevealSeedModal from './RevealSeedModal';
import InterstitialWarningModal from './InterstitialWarningModal';
// import * as walletActions from '../../../ducks/wallet';

// @connect(
//   () => ({}),
//   dispatch => ({
//     lockWallet: () => dispatch(walletActions.lockWallet()),
//     removeWallet: () => dispatch(walletActions.removeWallet())
//   })
// )
export default class Settings extends Component {
  render() {
    return (
      <ContentArea title="Settings" noPadding>
        <div className="settings__label">Network</div>
        <div className="settings__dropdown">
          <Dropdown
            reversed
            items={[
              {
                label: 'Mainnet'
              },
              {
                label: 'Testnet'
              }
            ]}
          />
        </div>
        <div className="settings__section-head">Your current account</div>
        <div className="settings__hd-path">m / 44' / 5353' / 0</div>
        <div className="settings__balance">0.00000 HNS</div>
        <ul className="settings__links">
          <li>
            <Link to="/settings/account-index">Change account index</Link>
          </li>
          <li>
            <a href="#" onClick={() => console.log('this.props.lockWallet')}>
              Log out
            </a>
          </li>
        </ul>
        <div className="settings__section-head">Your recovery seed phrase</div>
        <ul className="settings__links">
          <li>
            <Link to="/settings/reveal-seed">Reveal</Link>
          </li>
        </ul>
        <div className="settings__section-head">Reset your account</div>
        <ul className="settings__links">
          <li>
            <a href="#">Connect Ledger device</a>
          </li>
          <li>
            <Link to="/settings/import-seed">Import recovery seed phrase</Link>
          </li>
          <li>
            <Link to="/settings/new-wallet">Create a new wallet</Link>
          </li>
        </ul>
        <Switch>
          <Route path="/settings/account-index" component={AccountIndexModal} />
          <Route
            path="/settings/import-seed"
            render={() => (
              <InterstitialWarningModal
                nextAction={() => console.log('this.props.removeWallet')}
                nextRoute="/import-seed"
              />
            )}
          />
          <Route
            path="/settings/new-wallet"
            render={() => (
              <InterstitialWarningModal
                nextAction={console.log('this.props.removeWallet')}
                nextRoute="/"
              />
            )}
          />
          <Route path="/settings/reveal-seed" component={RevealSeedModal} />
        </Switch>
      </ContentArea>
    );
  }
}