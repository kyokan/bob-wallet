import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link, Route, Switch, withRouter } from 'react-router-dom';
import { ContentArea } from '../ContentArea';
import { connect } from 'react-redux';
import './index.scss';
import AccountIndexModal from './AccountIndexModal';
import RevealSeedModal from './RevealSeedModal';
import ZapTXsModal from './ZapTXsModal';
import * as logger from '../../utils/logClient';
import * as walletActions from '../../ducks/walletActions';
import * as nodeActions from '../../ducks/node';
import NetworkPicker from '../NetworkPicker';
import ExplorerPicker from '../ExplorerPicker';
import { clientStub as aClientStub } from '../../background/analytics/client';
const pkg = require('../../../package.json');
import c from "classnames";
import {Redirect} from "react-router";
import MiniModal from "../../components/Modal/MiniModal";
import copy from "copy-to-clipboard";
import {setCustomRPCStatus} from "../../ducks/node";
import CustomRPCConfigModal from "./CustomRPCConfigModal";
import {fetchWalletAPIKey} from "../../ducks/walletActions";
import Anchor from "../../components/Anchor";
import walletClient from "../../utils/walletClient";
import InterstitialWarningModal from "./InterstitialWarningModal";

const analytics = aClientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  (state) => ({
    network: state.node.network,
    apiKey: state.node.apiKey,
    walletApiKey: state.wallet.apiKey,
    walletSync: state.wallet.walletSync,
    wid: state.wallet.wid,
    changeDepth: state.wallet.changeDepth,
    receiveDepth: state.wallet.receiveDepth,
    isRunning: state.node.isRunning,
    isChangingNodeStatus: state.node.isChangingNodeStatus,
    isTestingCustomRPC: state.node.isTestingCustomRPC,
    isCustomRPCConnected: state.node.isCustomRPCConnected,
    transactions: state.wallet.transactions,
  }),
  dispatch => ({
    lockWallet: () => dispatch(walletActions.lockWallet()),
    reset: () => dispatch(walletActions.reset()),
    stopNode: () => dispatch(nodeActions.stop()),
    startNode: () => dispatch(nodeActions.start()),
    setCustomRPCStatus: isConnected => dispatch(setCustomRPCStatus(isConnected)),
    fetchWalletAPIKey: () => dispatch(fetchWalletAPIKey()),
  }),
)
export default class Settings extends Component {
  static propTypes = {
    network: PropTypes.string.isRequired,
    apiKey: PropTypes.string.isRequired,
    wid: PropTypes.string.isRequired,
    walletApiKey: PropTypes.string.isRequired,
    isRunning: PropTypes.bool.isRequired,
    walletSync: PropTypes.bool.isRequired,
    isChangingNodeStatus: PropTypes.bool.isRequired,
    lockWallet: PropTypes.func.isRequired,
    reset: PropTypes.func.isRequired,
    stopNode: PropTypes.func.isRequired,
    startNode: PropTypes.func.isRequired,
    setCustomRPCStatus: PropTypes.func.isRequired,
    transactions: PropTypes.object.isRequired,
  };

  componentDidMount() {
    analytics.screenView('Settings');
    this.props.fetchWalletAPIKey();
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

  renderNav() {
    const { history, location } = this.props;

    return (
      <div className="settings__nav">
        <div
          className={c("settings__nav__item", {
            'settings__nav__item--selected': location.pathname === '/settings/general',
          })}
          onClick={() => history.push("/settings/general")}
        >
          General
        </div>
        <div
          className={c("settings__nav__item", {
            'settings__nav__item--selected': location.pathname === '/settings/wallet',
          })}
          onClick={() => history.push("/settings/wallet")}
        >
          Wallet
        </div>
        <div
          className={c("settings__nav__item", {
            'settings__nav__item--selected': location.pathname === '/settings/connection',
          })}
          onClick={() => history.push("/settings/connection")}
        >
          Network & Connection
        </div>
        <div className="settings__footer">
          Bob v{pkg.version}
        </div>
      </div>
    );
  }

  renderSection(
    title = '',
    description = '',
    cta = '',
    onClick,
    children,
    disabled = false,
  ) {
    return (
      <div
        className={c("settings__content__section", {
          'settings__content__section--disabled': disabled,
        })}
      >
        <div className="settings__content__section__info">
          <div className="settings__content__section__info__title">
            {title}
          </div>
          <div className="settings__content__section__info__description">
            {description}
          </div>
        </div>
        <div className="settings__content__section__footer">
          {children}
          {cta && (
            <button
              className="settings__content__section__cta"
              onClick={onClick}
              disabled={disabled}
            >
              {cta}
            </button>
          )}
        </div>
      </div>
    )
  }

  renderWallet() {
    const {
      history,
      lockWallet,
      transactions,
      wid,
      walletSync,
    } = this.props;

    return (
      <>
        {this.renderSection(
          'Lock Wallet',
          'Log out and lock wallet',
          'Logout',
          lockWallet,
        )}
        {this.renderSection(
          'Rescan Wallet',
          <div>
            <div>{`${transactions.size} transactions found in walletdb`}</div>
          </div>,
          'Rescan',
          () => walletClient.rescan(0),
          null,
          walletSync,
        )}

        {this.renderSection(
          'API Key',
          <span>
            API key for <Anchor href="https://hsd-dev.org/api-docs/#get-wallet-info">hsw-cli</Anchor> and <Anchor href="https://hsd-dev.org/api-docs/#selectwallet">hsw-rpc</Anchor>. Make sure you select the wallet id "{wid}".
          </span>,
          'View API Key',
          () => history.push('/settings/wallet/view-api-key'),
        )}
        {this.renderSection(
          'Delete unconfirmed transactions',
          'This will only remove pending tx from the wallet',
          'Zap',
          () => history.push('/settings/wallet/zap-txs'),
        )}
        {this.renderSection(
          'Reveal recovery seed phrase',
          'This will display my unencrypted seed phrase',
          'Reveal',
          () => history.push('/settings/wallet/reveal-seed'),
        )}
        {this.renderSection(
          'Create new wallet',
          'This will allow you to create a new wallet',
          'Create New',
          () => history.push('/funding-options'),
        )}
        {this.renderSection(
          'Remove wallet',
          `Remove "${wid}" from Bob`,
          'Remove Wallet',
          () => history.push('/settings/wallet/remove-wallet'),
        )}
      </>
    );
  }

  renderContent() {
    const {
      isRunning,
      history,
      stopNode,
      startNode,
      isChangingNodeStatus,
      isTestingCustomRPC,
      isCustomRPCConnected,
      network
    } = this.props;

    return (
      <div className="settings__content">
        <Switch>
          <Route path="/settings/general">
            <>
              {this.renderSection(
                'Download log',
                'Download log for debugging',
                'Download',
                this.onDownload,
              )}
              {this.renderSection(
                'Blockchain Explorer',
                'Transactions and names will be opened on this explorer',
                null,
                null,
                <ExplorerPicker />,
                false,
              )}
            </>
          </Route>
          <Route path="/settings/connection">
            <>
              {this.renderSection(
                'HSD status',
                isRunning
                  ? <><span className="node-status--active" /><span>Node is running</span></>
                  : <><span className="node-status--inactive" /><span>Node is not running</span></>,
                isRunning ? 'Stop' : 'Start',
                isRunning ? stopNode : startNode,
                <button
                  className="settings__view-api-btn"
                  disabled={!isRunning || isChangingNodeStatus || isTestingCustomRPC}
                  onClick={() => history.push('/settings/connection/view-api-key')}
                >
                  View API Key
                </button>,
                isChangingNodeStatus || isTestingCustomRPC,
              )}
              {this.renderSection(
                'Custom RPC',
                isRunning
                  ? 'Disabled while HSD is running'
                  : (
                    isCustomRPCConnected ?
                      <><span className="node-status--active" /><span>Custom RPC Connected</span></>
                      :
                      'Set custom rpc to a Handshake node'
                  ),
                'Configure',
                () => history.push("/settings/connection/configure"),
                <button
                  className="settings__view-api-btn"
                  disabled={isRunning || isChangingNodeStatus || isTestingCustomRPC}
                  onClick={stopNode}
                >
                  Test Connection
                </button>,
                isRunning || isTestingCustomRPC || isChangingNodeStatus,
              )}
              {this.renderSection(
                'Network type',
                (
                  isCustomRPCConnected
                  ?
                    `Cannot change custom RPC network. RPC network set to: ${network || 'main'}`
                    :
                    'Switch network type'
                ),
                null,
                null,
                isRunning ? <NetworkPicker /> : null,
                !isRunning || isTestingCustomRPC || isChangingNodeStatus,
              )}
            </>
          </Route>
          <Route path="/settings/wallet">
            {this.renderWallet()}
          </Route>
          <Route>
            <Redirect to="/settings/general" />
          </Route>
        </Switch>
      </div>
    )
  }

  render() {
    return (
      <ContentArea className="settings" noPadding>
        { this.renderNav() }
        { this.renderContent() }
        <Switch>
          <Route path="/settings/wallet/account-index" component={AccountIndexModal} />
          <Route
            path="/settings/wallet/remove-wallet"
            render={() => (
              <InterstitialWarningModal
                nextAction={async () => {
                  await walletClient.removeWalletById(this.props.wid);
                  this.props.history.push('/login');
                }}
                nextRoute="/"
              />
            )}
          />
          <Route path="/settings/wallet/reveal-seed" component={RevealSeedModal} />
          <Route path="/settings/wallet/zap-txs" component={ZapTXsModal} />
          <Route path="/settings/connection/configure" component={CustomRPCConfigModal} />
          <Route path="/settings/wallet/view-api-key">
            <MiniModal
              closeRoute="/settings/wallet"
              title="Wallet API Key"
              centered
            >
              <input
                type="text"
                className="settings__copy-api-key"
                value={this.props.walletApiKey}
                readOnly
              />
              <button className="settings__btn" onClick={() => copy(this.props.walletApiKey)}>
                Copy
              </button>
            </MiniModal>
          </Route>
          <Route path="/settings/connection/view-api-key">
            <MiniModal
              closeRoute="/settings/connection"
              title="API Key"
              centered
            >
              <input
                type="text"
                className="settings__copy-api-key"
                value={this.props.apiKey}
                readOnly
              />
              <button className="settings__btn" onClick={() => copy(this.props.apiKey)}>
                Copy
              </button>
            </MiniModal>
          </Route>
        </Switch>
      </ContentArea>
    );
  }
}

function SettingSection(props) {
  const {
    disabled = false,
    title = '',
    description = '',
    children,
    cta,
    onClick,
  } = props;
  return (
    <div
      className={c("settings__content__section", {
        'settings__content__section--disabled': disabled,
      })}
    >
      <div className="settings__content__section__info">
        <div className="settings__content__section__info__title">
          {title}
        </div>
        <div className="settings__content__section__info__description">
          {description}
        </div>
      </div>
      <div className="settings__content__section__footer">
        {children}
        {cta && (
          <button
            className="settings__content__section__cta"
            onClick={onClick}
            disabled={disabled}
          >
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}
