import React, { Component } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import PropTypes from 'prop-types';
import SubHeader from '../../components/SubHeader';
import FundAccessOptions from '../FundAccessOptions';
import CreateNewAccount from '../CreateNewAccount';
import ExistingAccountOptions from '../ExistingAccountOptions';
import ImportSeedFlow from '../ImportSeedFlow';
import ConnectLedgerFlow from '../ConnectLedgerFlow';
import Account from '../Account';
import GetCoins from '../GetCoins';
import Settings from '../Settings';
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
        <SubHeader />
        <div className="app__content">{this.renderRoutes()}</div>
        <div className="app__footer">{/*<Footer />*/}</div>
      </div>
    );
  }

  renderRoutes() {
    let { isLocked, initialized } = this.props;

    // temp fix to import UI
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
        {/*<Route path="/domain/:name?" component={Auction} />*/}
        {this.renderDefault()}
      </Switch>
    );
  }

  renderDefault = () => {
    let { isLocked, initialized } = this.props;

    // temp fix to import UI
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
