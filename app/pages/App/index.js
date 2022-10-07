import React, { Component } from 'react';
import { Redirect, Route, Switch, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import SendModal from '../../components/SendModal';
import ReceiveModal from '../../components/ReceiveModal';
import FundAccessOptions from '../Onboarding/FundAccessOptions';
import CreateNewAccount from '../Onboarding/CreateNewAccount';
import ExistingAccountOptions from '../Onboarding/ExistingAccountOptions';
import ImportSeedFlow from '../Onboarding/ImportSeedFlow';
import Account from '../Account';
import GetCoins from '../GetCoins';
import Settings from '../Settings';
import Auction from '../Auction';
import DomainManager from '../DomainManager';
import MyDomain from '../MyDomain';
import YourBids from '../YourBids';
import Watching from '../Watching';
import SearchTLD from '../SearchTLD';
import * as nodeActions from "../../ducks/node";
import * as walletActions from '../../ducks/walletActions';
import './app.scss';
import AccountLogin from '../AcountLogin';
import PassphraseModal from '../AcountLogin/PassphraseModal';
import * as node from '../../ducks/node';
import SplashScreen from "../../components/SplashScreen";
import IdleModal from '../../components/IdleModal';
import {LedgerModal} from "../../components/LedgerModal";
import {MultisigModal} from "../../components/MultisigModal";
import Notification from "../../components/Notification";
import {clientStub as cClientStub} from "../../background/connections/client";
import {clientStub as sClientStub} from "../../background/setting/client";
import {ConnectionTypes} from "../../background/connections/service";
import AppHeader from "../AppHeader";
import Exchange from '../Exchange';
import SignMessage from "../SignMessage";
import VerifyMessage from "../VerifyMessage";
import {fetchLocale, initHip2, checkForUpdates} from "../../ducks/app";
import Multisig from "../Multisig";
import {I18nContext} from "../../utils/i18n";
const connClient = cClientStub(() => require('electron').ipcRenderer);
const settingClient = sClientStub(() => require('electron').ipcRenderer);

@connect(
  (state) => ({
    walletInitialized: state.wallet.initialized,
    wallets: state.wallet.wallets,
  }),
  (dispatch) => ({
    initHip2: () => dispatch(initHip2()),
    setExplorer: (explorer) => dispatch(nodeActions.setExplorer(explorer)),
    checkForUpdates: () => dispatch(checkForUpdates()),
    fetchLocale: () => dispatch(fetchLocale()),
  }),
)
class App extends Component {
  static propTypes = {
    walletInitialized: PropTypes.bool.isRequired,
    wallets: PropTypes.array.isRequired,
    error: PropTypes.string.isRequired,
    isLocked: PropTypes.bool.isRequired,
    startNode: PropTypes.func.isRequired,
    watchActivity: PropTypes.func.isRequired,
    initHip2: PropTypes.func.isRequired,
    setExplorer: PropTypes.func.isRequired,
    fetchLocale: PropTypes.func.isRequired,
    isChangingNetworks: PropTypes.bool.isRequired,
  };

  static contextType = I18nContext;

  state = {
    isLoading: true,
    isListingWallets: true,
    custtomRPCNetworkType: '',
  };

  async componentDidMount() {
    this.setState({isLoading: true});
    this.props.fetchLocale();
    this.props.checkForUpdates();
    await this.props.startNode();
    await this.props.initHip2();
    this.props.watchActivity();

    const {type} = await connClient.getConnection();

    if (type === ConnectionTypes.Custom) {
      await this.fetchCustomRPC();
    } else {
      this.setState({ customRPCNetworkType: '' })
    }

    this.fetchExplorer().then(explorer => {
      this.props.setExplorer(explorer)
    });

    setTimeout(() => this.setState({isLoading: false}), 1000);
  }

  async fetchCustomRPC() {
    const conn = await connClient.getCustomRPC();
    this.setState({
      customRPCNetworkType: conn.networkType || 'main',
    });
  }

  async fetchExplorer() {
    const explorer = await settingClient.getExplorer();
    return explorer || {
      label: 'HNS Network',
      tx: 'https://hnsnetwork.com/txs/%s',
      name: 'https://hnsnetwork.com/names/%s',
      address: 'https://hnsnetwork.com/address/%s',
    }
  }

  render() {
    if (this.props.error) {
      return <SplashScreen error={this.props.error} />;
    }

    if (this.state.isLoading || this.props.isChangingNetworks) {
      return <SplashScreen />;
    }

    return (
      <div className="app">
        {/*<WalletSync />*/}
        <IdleModal />
        <PassphraseModal />
        {this.renderContent()}
      </div>
    );
  }

  renderContent() {
    const {t} = this.context;
    const {isLocked, wallets, walletInitialized} = this.props;

    return (
      <>
        <LedgerModal />
        <MultisigModal />
        <Notification />
        <Switch>
          <Route
            path="/login"
            render={this.uninitializedWrapper(() => <AccountLogin className="app__login" />, true, true)}
          />
          <Route path="/funding-options" render={this.uninitializedWrapper(FundAccessOptions, true)} />
          <Route path="/existing-options" render={this.uninitializedWrapper(ExistingAccountOptions)} />
          <Route
            path="/new-wallet/:loc"
            render={this.uninitializedWrapper(
              CreateNewAccount,
              false,
              false,
              true,
            )}
          />
          <Route
            path="/import-seed/:type"
            render={this.uninitializedWrapper(
              ImportSeedFlow,
              false,
              false,
              true,
            )}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/account"
            render={this.routeRenderer(t('headingPortfolio'), Account, true, false)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/send"
            render={this.routeRenderer(t('headingSend'), SendModal)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/receive"
            render={this.routeRenderer(t('headingReceive'), ReceiveModal)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/sign_message"
            render={this.routeRenderer(t('headingSignMessage'), SignMessage)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/verify_message"
            render={this.routeRenderer(t('headingVerifyMessage'), VerifyMessage)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/get_coins"
            render={this.routeRenderer(t('headingClaimAirdropName'), GetCoins)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/settings"
            render={this.routeRenderer('', Settings, false, false)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/bids/:filterType?"
            render={this.routeRenderer(t('headingYourBids'), YourBids)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/domains"
            render={this.routeRenderer('', SearchTLD, false)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/watching"
            render={this.routeRenderer(t('headingWatching'), Watching)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/domain_manager/:name"
            render={this.routeRenderer(t('headingDomainManager'), MyDomain)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/domain_manager"
            render={this.routeRenderer(t('headingDomainManager'), DomainManager)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/domain/:name?"
            render={this.routeRenderer('', Auction, false)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/exchange"
            render={this.routeRenderer(t('headingExchange'), Exchange, true)}
          />
          <ProtectedRoute
            isLocked={isLocked}
            wallets={wallets}
            path="/multisig"
            render={this.routeRenderer(
              t(walletInitialized ? 'headingMultisig' : 'headingMultisigSetup'),
              Multisig, true
            )}
          />
          <Redirect to="/login" />
        </Switch>
      </>
    );
  }

  uninitializedWrapper(Component, isMainMenu = false, autoHeight = false, autoWidth = false) {
    const {history, isRunning} = this.props;
    return () => (
      <div className="app__uninitialized-wrapper">
        <AppHeader isMainMenu={isMainMenu} />
        <div className={c('app__uninitialized', {
          'app__uninitialized--auto-height': autoHeight,
          'app__uninitialized--auto-width': autoWidth,
        })}>
          <Component />
        </div>
      </div>
    );
  }

  routeRenderer(title, Component, showSidebar = true, padded = true) {
    return () => (
      <React.Fragment>
        {showSidebar && (
          <div className={'app__sidebar-wrapper'}>
            <Sidebar />
          </div>
        )}
        <div className="app__main-wrapper">
          <Topbar title={title} showLogo={!showSidebar} />
          {
            padded
              ? (
                <div className="app__content">
                  <Component />
                </div>
              )
              : <Component />
          }

        </div>
      </React.Fragment>
    );
  }
}

const OPEN_ROUTES = [
  '/settings/connection',
  '/settings/connection/configure',
]

const ProtectedRoute = (props) => {
  if (OPEN_ROUTES.includes(props.location.pathname)) {
    return <Route {...props} />;
  }

  if (!props.wallets.length) {
    return <Redirect to="/funding-options" />;
  }

  if (props.isLocked) {
    return <Redirect to="/login" />;
  }

  return <Route {...props} />;
};

export default withRouter(
  connect(
    state => ({
      error: state.node.error,
      isLocked: state.wallet.isLocked,
      isChangingNetworks: state.node.isChangingNetworks,
      isRunning: state.node.isRunning,
    }),
    dispatch => ({
      watchActivity: () => dispatch(walletActions.watchActivity()),
      startNode: () => dispatch(node.startApp()),
    })
  )(App),
);
