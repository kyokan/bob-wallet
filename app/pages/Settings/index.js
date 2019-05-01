import React, { Component } from 'react';
import { Link, Route, Switch, withRouter } from 'react-router-dom';
import { ContentArea } from '../ContentArea';
import { connect } from 'react-redux';
import './index.scss';
import AccountIndexModal from './AccountIndexModal';
import RevealSeedModal from './RevealSeedModal';
import InterstitialWarningModal from './InterstitialWarningModal';
import * as logger from '../../utils/logClient';
import * as walletActions from '../../ducks/walletActions';
import NetworkPicker from '../NetworkPicker';

@withRouter
@connect(
  (state) => ({
    network: state.node.network,
  }),
  dispatch => ({
    lockWallet: () => dispatch(walletActions.lockWallet()),
    removeWallet: () => dispatch(walletActions.removeWallet()),
  })
)
export default class Settings extends Component {

  onDownload = async () => {
    try {
      const content = await logger.download();
      const csvContent = `data:text/log;charset=utf-8,${content}\r\n`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "bob-debug.log");
      document.body.appendChild(link); // Required for FF
      link.click();
      link.remove();
    } catch (e) {
      logger.error(e.message);
      setTimeout(() => {
        throw e;
      }, 0);
    }
  };

  render() {
    return (
      <ContentArea title="Settings" noPadding>
        <div className="settings__label">Network</div>
        <div className="settings__dropdown">
          <NetworkPicker />
        </div>
        <ul className="settings__links">
          <li>
            <a href="#" onClick={this.props.lockWallet}>
              Log out
            </a>
          </li>
          <li>
            <div className="settings__link" onClick={this.onDownload}>
              Download logs
            </div>
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
                nextAction={() => this.props.removeWallet()}
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
