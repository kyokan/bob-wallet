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
import Notification from '../../components/Notification';
import SplashScreen from "../../components/SplashScreen";
import NetworkPicker from '../NetworkPicker';

class App extends Component {
  static propTypes = {
    error: PropTypes.string.isRequired,
    isLocked: PropTypes.bool.isRequired,
    initialized: PropTypes.bool.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    startNode: PropTypes.func.isRequired,
    isChangingNetworks: PropTypes.bool.isRequired,
  };

  state = {
    isLoading: true
  };

  async componentDidMount() {
    this.setState({isLoading: true});
    await this.props.startNode();
    await this.props.fetchWallet();
    setTimeout(() => this.setState({isLoading: false}), 1000)
  }

  render() {
    // TODO: Confirm that error shows properly
    if (this.props.error) {
      return <SplashScreen error={this.props.error} />
    }

    if (this.state.isLoading || this.props.isChangingNetworks) {
      return <SplashScreen />;
    }

    return <div className="app">{this.renderContent()}</div>;
  }

  renderContent() {
    const { isLocked, initialized } = this.props;

    if (isLocked || !initialized) {
      return (
        <Switch>
          <Route
            path="/login"
            render={() => <AccountLogin className="app__login" />}
          />
          <Route path="/funding-options" render={this.uninitializedWrapper(FundAccessOptions, true)} />
          <Route path="/existing-options" render={this.uninitializedWrapper(ExistingAccountOptions)} />
          <Route path="/new-wallet" render={this.uninitializedWrapper(CreateNewAccount)} />
          <Route path="/import-seed" render={this.uninitializedWrapper(ImportSeedFlow)} />
          <Route path="/connect-ledger" render={this.uninitializedWrapper(ConnectLedgerFlow)} />
          {this.renderDefault()}
        </Switch>

        // <div className="app__uninitialized-wrapper">
        //   <div className="app__logo">
        //     <div className="app__logo--text">
        //       Allison x Bob
        //     </div>
        //   </div>
        //   <div className="app__network-picker-wrapper">
        //     <div className="app__cancel" onClick={() => history.push('/')}>
        //       Back to Menu
        //     </div>
        //     <NetworkPicker /> 
        //   </div>
        //   <div className="app__uninitialized">
        //     <Switch>
        //       <Route
        //         path="/login"
        //         render={() => <AccountLogin className="app__login" />}
        //       />
        //       <Route path="/funding-options" render={FundAccessOptions} />
        //       <Route path="/existing-options" render={ExistingAccountOptions} />
        //       <Route path="/new-wallet" render={CreateNewAccount} />
        //       <Route path="/import-seed" render={ImportSeedFlow} />
        //       <Route path="/connect-ledger" render={ConnectLedgerFlow} />
        //       {this.renderDefault()}
        //     </Switch>
        //   </div>
        // </div>
      );
    }

    return (
      <React.Fragment>
        <Notification />
        {this.renderRoutes()}
      </React.Fragment>
    );
  }

  uninitializedWrapper(Component, isMainMenu = false) {
    const { history } = this.props;
    if (isMainMenu) {
      return () => (
        <div className="app__uninitialized-wrapper">
          <div className="app__logo">
            <div className="app__logo--text">
              Allison x Bob
            </div>
          </div>
          <div className="app__network-picker-wrapper">
            <NetworkPicker /> 
          </div>
          <div className="app__uninitialized"> 
            <Component />
          </div>
        </div>
      ) 
    } 
    
    return () => (
      <div className="app__uninitialized-wrapper">
        <div className="app__logo">
          <div className="app__logo--text">
            Allison x Bob
          </div>
        </div>
        <div className="app__network-picker-wrapper">
          <div className="app__cancel" onClick={() => history.push('/')}>
            Return to Menu
          </div>
        </div>
        <div className="app__uninitialized"> 
          <Component />
        </div>
      </div>
      )
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
      error: state.node.error,
      isLocked: state.wallet.isLocked,
      isChangingNetworks: state.node.isChangingNetworks,
      initialized: state.wallet.initialized
    }),
    dispatch => ({
      fetchWallet: () => dispatch(walletActions.fetchWallet()),
      startNode: () => dispatch(node.start()),
    })
  )(App)
);
