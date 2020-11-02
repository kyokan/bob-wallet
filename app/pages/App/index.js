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
import ConnectLedgerFlow from '../Onboarding/ConnectLedgerFlow';
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
import {ConnectionTypes} from "../../background/connections/service";
import AppHeader from "../AppHeader";
const connClient = cClientStub(() => require('electron').ipcRenderer);

@connect(
  (state) => ({
    wallets: state.wallet.wallets,
  }),
  (dispatch) => ({
    listWallets: () => dispatch(listWallets()),
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

    setTimeout(() => this.setState({isLoading: false}), 1000);
  }

  async fetchCustomRPC() {
    const conn = await connClient.getCustomRPC();
    this.setState({
      customRPCNetworkType: conn.networkType || 'main',
    });
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
            path="/new-wallet"
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
          <Route path="/connect-ledger" render={this.uninitializedWrapper(ConnectLedgerFlow)} />
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
          <Redirect to="/login" />
        </Switch>
      </>
    );
  }

  uninitializedWrapper(Component, isMainMenu = false, autoHeight = false, autoWidth = false) {
    const {history, isRunning} = this.props;
    if (isMainMenu) {
      return () => (
        <div className="app__uninitialized-wrapper">
          <AppHeader isMainMenu />
          <div className={c('app__uninitialized', {
            'app__uninitialized--auto-height': autoHeight,
            'app__uninitialized--auto-width': autoWidth,
          })}>
            <Component />
          </div>
        </div>
      );
    }

    return () => (
      <div className="app__uninitialized-wrapper">
        <AppHeader />
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
