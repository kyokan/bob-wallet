import React, { Component } from 'react';
import { Link, Route, Switch, withRouter } from 'react-router-dom';
import { ContentArea } from '../ContentArea';
import { connect } from 'react-redux';
import './index.scss';
import AccountIndexModal from './AccountIndexModal';
import RevealSeedModal from './RevealSeedModal';
import ZapTXsModal from './ZapTXsModal';
import InterstitialWarningModal from './InterstitialWarningModal';
import * as logger from '../../utils/logClient';
import * as walletActions from '../../ducks/walletActions';
import NetworkPicker from '../NetworkPicker';
import { clientStub as aClientStub } from '../../background/analytics/client';
const pkg = require('../../../package.json');

const analytics = aClientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  (state) => ({
    network: state.node.network,
    apiKey: state.node.apiKey,
  }),
  dispatch => ({
    lockWallet: () => dispatch(walletActions.lockWallet()),
    removeWallet: () => dispatch(walletActions.removeWallet()),
  }),
)
export default class Settings extends Component {
  componentDidMount() {
    analytics.screenView('Settings');
  }

  onDownload = async () => {
    try {
      const {network} = this.props;
      const content = await logger.download(network);
      const csvContent = `data:text/log;charset=utf-8,${content}\r\n`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `bob-debug-${network}.log`);
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
      <ContentArea noPadding>
        <div className="settings__supersection">Wallet Actions</div>
        <hr className="settings__separator"/>
        <ul className="settings__links">
          <li>
            <a href="#" onClick={this.props.lockWallet}>
              Lock wallet and logout
            </a>
          </li>
        </ul>
        <ul className="settings__links">
          <li>
            <Link to="/settings/zap-txs">Delete unconfirmed transactions</Link>
          </li>
        </ul>
        <ul className="settings__links">
          <li>
            <Link to="/settings/reveal-seed">Reveal recovery seed phrase</Link>
          </li>
        </ul>
        <ul className="settings__links">
          <li>
            <Link to="/settings/new-wallet">Remove wallet and create new wallet</Link>
          </li>
        </ul>
        <p />
        <div className="settings__supersection">Advanced</div>
        <hr className="settings__separator"/>
        <div className="settings__section-head">HSD API Key</div>
        <input type="text" className="settings__copy-api-key" value={this.props.apiKey} readOnly />
        <p />
        <div className="settings__section-head">Network</div>
        <div className="settings__dropdown">
          <NetworkPicker />
        </div>
        <div className="settings__section-head">Debug</div>
        <ul className="settings__links">
          <li>
            <div className="settings__link" onClick={this.onDownload}>
              Download log
            </div>
          </li>
        </ul>
        <Switch>
          <Route path="/settings/account-index" component={AccountIndexModal} />
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
          <Route path="/settings/zap-txs" component={ZapTXsModal} />
        </Switch>
        <div className="settings__footer">
          Bob v{pkg.version}
        </div>
      </ContentArea>
    );
  }
}
