import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Route, Switch, withRouter } from 'react-router-dom';
import { ContentArea } from '../ContentArea';
import { connect } from 'react-redux';
import './index.scss';
import AccountIndexModal from './AccountIndexModal';
import MaxIdleModal from './MaxIdleModal';
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
import DeepCleanAndRescanModal from "./DeepCleanAndRescanModal";
import {showError, showSuccess} from "../../ducks/notifications";
import BackupListingModal from "./BackupListingModal";
import fs from "fs";
const {dialog} = require('electron').remote;
import {clientStub as sClientStub} from "../../background/shakedex/client";
import ChangeDirectoryModal from "./ChangeDirectoryModal";
import dbClient from "../../utils/dbClient";
import {clientStub} from "../../background/node/client";
import APIKeyModal from "./APIKeyModal";
import {clientStub as cClientStub} from "../../background/connections/client";
import {ConnectionTypes} from "../../background/connections/service";

const analytics = aClientStub(() => require('electron').ipcRenderer);
const shakedex = sClientStub(() => require('electron').ipcRenderer);
const nodeClient = clientStub(() => require('electron').ipcRenderer);
const connClient = cClientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  (state) => ({
    network: state.wallet.network,
    apiKey: state.node.apiKey,
    noDns: state.node.noDns,
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
    setNoDns: (noDns) => dispatch(nodeActions.setNoDns(noDns)),
    setCustomRPCStatus: isConnected => dispatch(setCustomRPCStatus(isConnected)),
    fetchWalletAPIKey: () => dispatch(fetchWalletAPIKey()),
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
  }),
)
export default class Settings extends Component {
  static propTypes = {
    network: PropTypes.string.isRequired,
    apiKey: PropTypes.string.isRequired,
    noDns: PropTypes.bool.isRequired,
    wid: PropTypes.string.isRequired,
    changeDepth: PropTypes.number.isRequired,
    receiveDepth: PropTypes.number.isRequired,
    walletApiKey: PropTypes.string.isRequired,
    isRunning: PropTypes.bool.isRequired,
    walletSync: PropTypes.bool.isRequired,
    isChangingNodeStatus: PropTypes.bool.isRequired,
    lockWallet: PropTypes.func.isRequired,
    reset: PropTypes.func.isRequired,
    stopNode: PropTypes.func.isRequired,
    startNode: PropTypes.func.isRequired,
    setNoDns: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    setCustomRPCStatus: PropTypes.func.isRequired,
    transactions: PropTypes.object.isRequired,
    fetchWallet: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      changeDepth: props.changeDepth,
      receiveDepth: props.receiveDepth,
      isUpdatingDepth: false,
      customRPCStatus: '',
    }
  }

  async componentDidMount() {
    analytics.screenView('Settings');
    this.props.fetchWalletAPIKey();
    const directory = await nodeClient.getDir();
    const userDir = await dbClient.getUserDir();
    this.setState({
      directory,
      userDir,
    });
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

  onBackupWDB = async () => {
    try {
      let savePath = dialog.showOpenDialogSync({
        properties: ["openDirectory", "promptToCreate", "createDirectory"],
      });

      await walletClient.backup(savePath[0]);
      this.props.showSuccess(`WalletDB backup successfully`);
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  onDownloadExchangeBackup = async () => {
    const listings = await shakedex.getListings();
    const fills = await shakedex.getFulfillments();
    const data = JSON.stringify({listings, fills});
    const savePath = dialog.showSaveDialogSync({
      filters: [{name: 'exchange-listing', extensions: ['json']}],
    });

    return new Promise((resolve, reject) => {
      if (savePath) {
        fs.writeFile(savePath, data, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(savePath);
          }
        });
      }
    });
  };

  onRestoreExchangeListing = async () => {
    const {
      filePaths: [filepath]
    } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: {
        extensions: ['json'],
      },
    });

    try {
      const buf = await fs.promises.readFile(filepath);
      const {listings, fills} = JSON.parse(buf);

      for (let listing of listings) {
        await shakedex.restoreOneListing(listing)
      }

      for (let fill of fills) {
        await shakedex.restoreOneFill(fill)
      }

      await this.props.showSuccess(`Restored ${listings.length + fills.length} auctions.`);
    } catch (e) {
      this.props.showError(e.message);
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
        <div
          className={c("settings__nav__item", {
            'settings__nav__item--selected': location.pathname === '/settings/exchange',
          })}
          onClick={() => history.push("/settings/exchange")}
        >
          Exchange
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
    disableButtonOnly = false,
  ) {
    return (
      <div
        className={c("settings__content__section", {
          'settings__content__section--disabled': disabled && !disableButtonOnly,
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
          'Backup WalletDB',
          <div>
            <div>{`Back up wallet database and files to a directory.`}</div>
          </div>,
          'Backup WalletDB',
          this.onBackupWDB,
        )}
        {this.renderSection(
          'Deep Clean and Rescan Wallet',
          <div>
            <div>For more information on deep clean, please see <Anchor href="https://github.com/handshake-org/hsd/blob/master/CHANGELOG.md#wallet-api-changes-1">here</Anchor></div>
          </div>,
          'Deep Clean + Rescan',
          () => history.push('/settings/wallet/deep-clean-and-rescan'),
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

  renderExchange() {
    const { history } = this.props;
    return (
      <>
        {this.renderSection(
          'Backup listing',
          'Download backup of all your listings and fulfillments',
          'Download',
          () => history.push('/settings/exchange/backup'),
        )}
        {this.renderSection(
          'Restore listing',
          'Restore your listing from backup',
          'Restore',
          this.onRestoreExchangeListing,
        )}
      </>
    )
  }

  startNode = async () => {
    await connClient.setConnectionType(ConnectionTypes.P2P);
    await nodeClient.reset();
    await this.props.setCustomRPCStatus(false);
    await this.props.fetchWallet();
  }

  renderContent() {
    const {
      isRunning,
      history,
      stopNode,
      startNode,
      noDns,
      setNoDns,
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
              {this.renderSection(
                'Idle Timeout',
                <span>
                  Automatically lock the wallet after a set period of inactivity
                </span>,
                'Change',
                () => history.push('/settings/general/max-idle'),
              )}
            </>
          </Route>
          <Route path="/settings/connection">
            <>
              {this.renderSection(
                'Internal HSD node',
                !isCustomRPCConnected && isRunning
                  ? <><span className="node-status--active" /><span>Node is running</span></>
                  : <><span className="node-status--inactive" /><span>Node is not running</span></>,
                'Start node',
                this.startNode,
                <button
                  className="settings__view-api-btn"
                  disabled={!isRunning || isChangingNodeStatus || isTestingCustomRPC || isCustomRPCConnected}
                  onClick={() => history.push('/settings/connection/view-api-key')}
                >
                  View API Key
                </button>,
                isChangingNodeStatus || isTestingCustomRPC || !isCustomRPCConnected && isRunning,
                true
              )}
              {this.renderSection(
                'Remote HSD node',
                isCustomRPCConnected && isRunning
                  ? <><span className="node-status--active" /><span>Custom RPC Connected</span></>
                  : <><span className="node-status--inactive" />Connect to a remote HSD node via HTTP</>,
                'Configure',
                () => history.push("/settings/connection/configure"),
                null,
                isCustomRPCConnected || isTestingCustomRPC || isChangingNodeStatus,
                true
              )}
              {this.renderSection(
                'DNS Servers',
                !isRunning || noDns
                  ? <><span className="node-status--inactive" /><span>DNS servers are not running</span></>
                  : <><span className="node-status--active" /><span>DNS servers are running</span></>,
                noDns ? 'Enable' : 'Disable',
                () => {setNoDns(!noDns)},
                null,
                isChangingNodeStatus || isTestingCustomRPC || isCustomRPCConnected,
              )}
              {this.renderSection(
                'HSD Home Directory',
                <div>
                  <div><small>User Directory: {this.state.userDir}</small></div>
                  <div><small>HSD Directory: {this.state.directory}</small></div>
                </div>,
                'Change Directory',
                () => history.push("/settings/connection/changeDirectory"),
                null,
              )}
              {this.renderSection(
                'Network type',
                'Switch network type',
                null,
                null,
                <NetworkPicker />,
                isTestingCustomRPC || isChangingNodeStatus,
              )}
            </>
          </Route>
          <Route path="/settings/wallet">
            {this.renderWallet()}
          </Route>
          <Route path="/settings/exchange">
            {this.renderExchange()}
          </Route>
          <Route>
            <Redirect to="/settings/general" />
          </Route>
        </Switch>
        <div className="settings__footer">
          Bob v{pkg.version}
        </div>
      </div>
    )
  }

  render() {
    return (
      <ContentArea className="settings" noPadding>
        { this.renderNav() }
        { this.renderContent() }
        <Switch>
          <Route path="/settings/general/max-idle" component={MaxIdleModal} />
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
          <Route path="/settings/connection/changeDirectory" component={ChangeDirectoryModal} />
          <Route path="/settings/wallet/view-api-key">
            <APIKeyModal
              closeRoute="/settings/wallet"
              title="Wallet API Key"
              apiKey={this.props.walletApiKey}
              updateAPIKey={walletClient.setAPIKey}
            />
          </Route>
          <Route path="/settings/connection/view-api-key">
            <APIKeyModal
              closeRoute="/settings/connection"
              title="Node API Key"
              apiKey={this.props.apiKey}
              updateAPIKey={nodeClient.setAPIKey}
            />
          </Route>
          <Route path="/settings/wallet/deep-clean-and-rescan">
            <DeepCleanAndRescanModal />
          </Route>
          <Route
            path="/settings/exchange/backup"
            render={() => (
              <BackupListingModal
                nextAction={this.onDownloadExchangeBackup}
                nextRoute="/settings/exchange"
              />
            )}
          />
        </Switch>
      </ContentArea>
    );
  }
}
