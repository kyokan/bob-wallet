import React, { Component } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import PropTypes from 'prop-types';
import SubHeader from '../../components/SubHeader';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import FundAccessOptions from '../Onboarding/FundAccessOptions';
import CreateNewAccount from '../Onboarding/CreateNewAccount';
import ExistingAccountOptions from '../Onboarding/ExistingAccountOptions';
import ImportSeedFlow from '../Onboarding/ImportSeedFlow';
import ConnectLedgerFlow from '../Onboarding/ConnectLedgerFlow';
import Account from '../Account';
import GetCoins from '../GetCoins';
import Settings from '../Settings';
// import Auction from '../Auction';
import Footer from '../Footer';
import './app.scss';

export default class Home extends Component {
  // static propTypes = {
  //   isLocked: PropTypes.bool.isRequired,
  //   initialized: PropTypes.bool.isRequired
  // };

  state = {
    isLoading: false
  };

  render() {
    return (
      <div className="app">
        {/* <SubHeader /> */}
        <div className="app__sidebar-wrapper">
          <Sidebar />
        </div>
        <div className="app__main-wrapper">
          <Topbar title="Portfolio" />
          <div className="app__content">{this.renderRoutes()}</div>
        </div>
        {/* <div className="app__footer">
          <Footer />
        </div> */}
      </div>
    );
  }

  renderRoutes() {
    let { isLocked, initialized } = this.props;

    // temp fix to show authenticated views until ducks are set up
    isLocked = false;
    initialized = true;

    if (this.state.isLoading) {
      return null;
    }

    if (isLocked || !initialized) {
      return (
        <Switch>
          {/* Do we need this route? */}
          {/* <Route
            path="/login"
            render={() => <AccountLogin className="app__login" />}
          /> */}
          <Route
            path="/funding-options"
            render={this.renderWrapper(FundAccessOptions)}
          />
          <Route
            path="/existing-options"
            render={this.renderWrapper(ExistingAccountOptions)}
          />
          <Route
            path="/new-wallet"
            render={this.renderWrapper(CreateNewAccount)}
          />
          <Route
            path="/import-seed"
            render={this.renderWrapper(ImportSeedFlow)}
          />
          <Route
            path="/connect-ledger"
            render={this.renderWrapper(ConnectLedgerFlow)}
          />
          {this.renderDefault()}
        </Switch>
      );
    }

    return (
      <Switch>
        <Route path="/account" component={Account} />
        <Route path="/send" component={Account} />
        <Route path="/receive" component={Account} />
        <Route path="/get_coins" component={GetCoins} />
        <Route path="/settings" component={Settings} />
        {/* Let's implement Auction once ducks are set up and we're connected to the blockchain  */}
        {/* <Route path="/domain/:name?" component={Auction} /> */}
        {this.renderDefault()}
      </Switch>
    );
  }

  renderDefault = () => {
    let { isLocked, initialized } = this.props;

    // temp fix to show authenticated views until ducks are set up
    isLocked = false;
    initialized = true;

    if (!initialized) {
      return <Redirect to="/funding-options" />;
    }

    if (isLocked) {
      return <Redirect to="/login" />;
    }

    return <Redirect to="/account" />;
  };

  renderWrapper = c => {
    const Comp = c;
    return () => (
      <div className="app__component-wrapper">
        <Comp />
      </div>
    );
  };
}
