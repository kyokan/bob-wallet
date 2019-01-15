import React, { Component } from 'react';
import { Redirect, Route, Switch, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
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
import * as walletActions from '../../ducks/wallet';
import './app.scss';
import AccountLogin from '../AcountLogin';
import * as node from '../../ducks/node';
import { NETWORKS } from '../../background/node';
import Notification from '../../components/Notification';

class App extends Component {
  static propTypes = {
    error: PropTypes.string.isRequired,
    isLocked: PropTypes.bool.isRequired,
    initialized: PropTypes.bool.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    startNode: PropTypes.func.isRequired
  };

  state = {
    isLoading: true
  };

  async componentDidMount() {
    this.setState({ isLoading: true });
    await this.props.startNode();
    await this.props.fetchWallet();
    await this.props.pollPendingTransactions();
    await this.props.pollLockState();
    setTimeout(() => this.setState({ isLoading: false }) , 1000)
  }

  render() {
    // TODO: Figure out how to get error
    if (this.props.error) {
      return this.renderSplash(this.props.error);
    }

    if (this.state.isLoading) {
      return this.renderSplash();
    }


    return <div className="app">{this.renderContent()}</div>;
  }

  renderSplash(error) {
    return (
      <div className="app__splash">
        <div className="app__splash__title"> 
          Allison x Bob
        </div>
        <div className="app__splash__logo__wrapper">
          <div className="app__splash__logo__alice" />
          <div className="app__splash__logo__bob" />
        </div>
        {error ? <div className="app__splash__text"> {error} </div> :  (
          <React.Fragment>
            <div className="app__splash__logo__spinner" />
            <div className="app__splash__text">Loading node...</div>
          </React.Fragment>
          )
        }
      </div>
      )
  }

  renderContent() {
    const { isLocked, initialized } = this.props;

    if (isLocked || !initialized) {
      return (
        <div className="app__uninitialized-wrapper">
          <div className="app__uninitialized">
            <Switch>
              <Route
                path="/login"
                render={() => <AccountLogin className="app__login" />}
              />
              <Route path="/funding-options" render={FundAccessOptions} />
              <Route path="/existing-options" render={ExistingAccountOptions} />
              <Route path="/new-wallet" render={CreateNewAccount} />
              <Route path="/import-seed" render={ImportSeedFlow} />
              <Route path="/connect-ledger" render={ConnectLedgerFlow} />
              {this.renderDefault()}
            </Switch>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment>
        <Notification />
        {this.renderRoutes()}
      </React.Fragment>
    );
  }

  renderRoutes() {
    return (
      <Switch>
        <Route
          path="/account"
          render={this.routeRenderer('Portfolio', Account)}
        />
        <Route path="/send" render={this.routeRenderer('Send', SendModal)} />
        <Route
          path="/receive"
          render={this.routeRenderer('Receive', ReceiveModal)}
        />
        <Route
          path="/get_coins"
          render={this.routeRenderer('Get Coins', GetCoins)}
        />
        <Route
          path="/settings"
          render={this.routeRenderer('Settings', Settings)}
        />
        <Route path="/bids" render={this.routeRenderer('Domains', YourBids)} />
        <Route
          path="/domains"
          render={this.routeRenderer('Domains', SearchTLD, false)}
        />
        <Route
          path="/watching"
          render={this.routeRenderer('Watching', Watching)}
        />
        <Route
          path="/domain_manager/:name"
          render={this.routeRenderer('Domain Manager', MyDomain)}
        />
        <Route
          path="/domain_manager"
          render={this.routeRenderer('Domain Manager', DomainManager)}
        />
        <Route
          path="/domain/:name?"
          render={this.routeRenderer('Browse Domains', Auction, false)}
        />
        {this.renderDefault()}
      </Switch>
    );
  }

  routeRenderer(title, Component, showSidebar = true) {
    return () => (
      <React.Fragment>
        {showSidebar && (
          <div className={'app__sidebar-wrapper'}>
            <Sidebar />
          </div>
        )}
        <div className="app__main-wrapper">
          <Topbar title={title} showLogo={!showSidebar} />
          <div className="app__content">
            <Component />
          </div>
        </div>
      </React.Fragment>
    );
  }

  renderDefault = () => {
    let { isLocked, initialized } = this.props;
    if (!initialized) {
      return <Redirect to="/funding-options" />;
    }

    if (isLocked) {
      return <Redirect to="/login" />;
    }

    return <Redirect to="/account" />;
  };
}

export default withRouter(
  connect(
    state => ({
      error: state.node.error,
      isLocked: state.wallet.isLocked,
      initialized: state.wallet.initialized
    }),
    dispatch => ({
      fetchWallet: () => dispatch(walletActions.fetchWallet()),
      startNode: () => dispatch(node.start(NETWORKS.SIMNET)),
      pollPendingTransactions: () => dispatch(walletActions.pollPendingTransactions()),
      pollLockState: () => dispatch(walletActions.pollLockState()),
    })
  )(App)
);
