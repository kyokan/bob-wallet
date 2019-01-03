import React, { Component } from 'react';
import { Redirect, Route, Switch, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import SubHeader from '../../components/SubHeader';
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
// import Auction from '../Auction';
import Footer from '../Footer';
import * as walletActions from '../../ducks/wallet';
import './app.scss';

class App extends Component {
  static propTypes = {
    isLocked: PropTypes.bool.isRequired,
    initialized: PropTypes.bool.isRequired
  };

  state = {
    isLoading: false
  };

  componentDidMount() {
    this.props.isInitialized();
  }

  render() {
    return (
      <div className="app">
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
          <Route path="/funding-options" render={FundAccessOptions} />
          <Route path="/existing-options" render={ExistingAccountOptions} />
          <Route path="/new-wallet" render={CreateNewAccount} />
          <Route path="/import-seed" render={ImportSeedFlow} />
          <Route path="/connect-ledger" render={ConnectLedgerFlow} />
          {this.renderDefault()}
        </Switch>
      );
    }
    return (
      <Switch>
        <Route path="/account" component={Account} />
        <Route path="/send" component={SendModal} />
        <Route path="/receive" component={ReceiveModal} />
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
      isInitialized: () => dispatch(walletActions.isInitialized())
    })
  )(App)
);
