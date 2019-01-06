import React, { Component } from 'react';
import { Redirect, Route, Switch, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import SendModal from '../../components/SendModal';
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
import SearchTLD from '../SearchTLD';
import * as walletActions from '../../ducks/wallet';
import './app.scss';
import AccountLogin from '../AcountLogin';
import * as node from '../../ducks/node';
import { NETWORKS } from '../../background/node';
import Notification from '../../components/Notification';

class App extends Component {
  static propTypes = {
    isLocked: PropTypes.bool.isRequired,
    initialized: PropTypes.bool.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    startNode: PropTypes.func.isRequired,
  };

  state = {
    isLoading: true
  };

  async componentDidMount() {
    this.setState({
      isLoading: true
    });
    await this.props.startNode();
    await this.props.fetchWallet();
    this.setState({
      isLoading: false
    });
  }

  render() {
    return (
      <div className="app">
        {this.renderContent()}
      </div>
    );
  }

  renderContent() {
    if (this.state.isLoading) {
      return null;
    }

    const {isLocked, initialized} = this.props;

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
        <div className="app__sidebar-wrapper">
          <Sidebar />
        </div>
        <div className="app__main-wrapper">
          {this.renderRoutes()}
        </div>
      </React.Fragment>
    );
  }

  renderRoutes() {
    return (
      <Switch>
        <Route path="/account" render={this.routeRenderer('Portfolio', Account)} />
        <Route path="/send" render={this.routeRenderer('Send', SendModal)} />
        <Route path="/get_coins" render={this.routeRenderer('Get Coins', GetCoins)} />
        <Route path="/settings" render={this.routeRenderer('Settings', Settings)} />
        <Route path="/domains" render={this.routeRenderer('Domains', SearchTLD)} />
        <Route path="/domain_manager/:name" render={this.routeRenderer('Domain Manager', MyDomain)} />
        <Route path="/domain_manager" render={this.routeRenderer('Domain Manager', DomainManager)} />
        <Route path="/domain/:name?" render={this.routeRenderer('Browse Domains', Auction)} />
        {this.renderDefault()}
      </Switch>
    );
  }

  routeRenderer(title, Component) {
    return () => (
      <React.Fragment>
        <Topbar title={title} />
        <div className="app__content">
          <Component />
        </div>
      </React.Fragment>
    );
  }

  renderDefault = () => {
    let {isLocked, initialized} = this.props;
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
      isLocked: state.wallet.isLocked,
      initialized: state.wallet.initialized
    }),
    dispatch => ({
      fetchWallet: () => dispatch(walletActions.fetchWallet()),
      startNode: () => dispatch(node.start(NETWORKS.SIMNET)),
    })
  )(App)
);
