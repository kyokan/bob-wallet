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
import { listWallets } from '../../ducks/walletActions';
import './app.scss';
import AccountLogin from '../AcountLogin';
import PassphraseModal from '../AcountLogin/PassphraseModal';
import * as node from '../../ducks/node';
import SplashScreen from "../../components/SplashScreen";
import IdleModal from '../../components/IdleModal';
import {LedgerModal} from "../../components/LedgerModal";
import Notification from "../../components/Notification";
import {clientStub as cClientStub} from "../../background/connections/client";
import {clientStub as sClientStub} from "../../background/setting/client";
import {ConnectionTypes} from "../../background/connections/service";
import AppHeader from "../AppHeader";
import Exchange from '../Exchange';
import {decrypt, encrypt} from "../../utils/encrypt";
const connClient = cClientStub(() => require('electron').ipcRenderer);
const settingClient = sClientStub(() => require('electron').ipcRenderer);

@connect(
  (state) => ({
    wallets: state.wallet.wallets,
  }),
  (dispatch) => ({
    listWallets: () => dispatch(listWallets()),
    setExplorer: (explorer) => dispatch(nodeActions.setExplorer(explorer)),
  }),
)
class App extends Component {
  static propTypes = {
    error: PropTypes.string.isRequired,
    isLocked: PropTypes.bool.isRequired,
    initialized: PropTypes.bool.isRequired,
    startNode: PropTypes.func.isRequired,
    watchActivity: PropTypes.func.isRequired,
    isChangingNetworks: PropTypes.bool.isRequired,
  };

  state = {
    isLoading: true,
    isListingWallets: true,
    custtomRPCNetworkType: '',
  };

  async componentDidMount() {
    this.setState({isLoading: true});
    await this.props.startNode();
    this.props.watchActivity();
    await this.props.listWallets();

    const {type} = await connClient.getConnection();

    if (type === ConnectionTypes.Custom) {
      await this.fetchCustomRPC();
    } else {
      this.setState({ customRPCNetworkType: '' })
    }

    this.fetchExplorer().then(explorer => {
      this.props.setExplorer(explorer)
    })

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
    // TODO: Confirm that error shows properly
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
    return (
      <>
        <LedgerModal />
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
            path="/import-seed"
            render={this.uninitializedWrapper(
              ImportSeedFlow,
              false,
              false,
              true,
            )}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/account"
            render={this.routeRenderer('Portfolio', Account, true, false)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/send"
            render={this.routeRenderer('Send', SendModal)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/receive"
            render={this.routeRenderer('Receive', ReceiveModal)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/get_coins"
            render={this.routeRenderer('Get Coins', GetCoins)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/settings"
            render={this.routeRenderer('Settings', Settings, false, false)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/bids"
            render={this.routeRenderer('Domains', YourBids)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/domains"
            render={this.routeRenderer('Domains', SearchTLD, false)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/watching"
            render={this.routeRenderer('Watching', Watching)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/domain_manager/:name"
            render={this.routeRenderer('Domain Manager', MyDomain)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/domain_manager"
            render={this.routeRenderer('Domain Manager', DomainManager)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/domain/:name?"
            render={this.routeRenderer('Browse Domains', Auction, false)}
          />
          <ProtectedRoute
            isLocked={this.props.isLocked}
            wallets={this.props.wallets}
            path="/exchange"
            render={this.routeRenderer('Exchange', Exchange, true)}
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

const ProtectedRoute = (props) => {
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
      initialized: state.wallet.initialized,
      isRunning: state.node.isRunning,
    }),
    dispatch => ({
      watchActivity: () => dispatch(walletActions.watchActivity()),
      startNode: () => dispatch(node.startApp()),
    })
  )(App),
);
