import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';

import ImportSeedWarning from '../ImportSeedWarning/index';
import CreatePassword from '../CreatePassword/index';
import ImportSeedEnterMnemonic from '../ImportSeedEnterMnemonic/index';
import Terms from '../Terms/index';
import * as walletActions from '../../../ducks/walletActions';
import walletClient from '../../../utils/walletClient';
import * as logger from '../../../utils/logClient';
import OptInAnalytics from '../OptInAnalytics';
import { clientStub as aClientStub } from '../../../background/analytics/client';
import { showError } from '../../../ducks/notifications';

const analytics = aClientStub(() => require('electron').ipcRenderer);

const TERMS_OF_USE = 'TERM_OF_USE';
const WARNING_STEP = 'WARNING';
const CREATE_PASSWORD = 'CREATE_PASSWORD';
const ENTRY_STEP = 'ENTRY';
const OPT_IN_ANALYTICS = 'ANALYTICS';

class ImportSeedFlow extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
    completeInitialization: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
    startWalletSync: PropTypes.func.isRequired,
    waitForWalletSync: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    fetchTransactions: PropTypes.func.isRequired,
  };

  state = {
    currentStep: WARNING_STEP,
    passphrase: '',
    mnemonic: '',
    isLoading: false,
  };

  render() {
    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            currentStep={0}
            totalSteps={4}
            onAccept={() => this.setState({currentStep: WARNING_STEP})}
            onBack={() => this.props.history.push('/existing-options')}
          />
        );
      case WARNING_STEP:
        return (
          <ImportSeedWarning
            currentStep={1}
            totalSteps={4}
            onBack={() => this.props.history.push('/existing-options')}
            onNext={() => this.goTo(CREATE_PASSWORD)}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={2}
            totalSteps={4}
            onBack={() => this.setState({currentStep: WARNING_STEP})}
            onNext={passphrase => {
              this.setState({
                passphrase,
                currentStep: ENTRY_STEP,
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case ENTRY_STEP:
        return (
          <ImportSeedEnterMnemonic
            currentStep={3}
            totalSteps={4}
            onBack={() => this.goTo(CREATE_PASSWORD)}
            onNext={(mnemonic) => {
              this.setState({
                mnemonic,
              });
              this.goTo(OPT_IN_ANALYTICS);
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case OPT_IN_ANALYTICS:
        return (
          <OptInAnalytics
            currentStep={4}
            totalSteps={4}
            onBack={() => this.setState({currentStep: ENTRY_STEP})}
            onNext={async (optInState) => {
              await analytics.setOptIn(optInState);
              await this.finishFlow(this.state.mnemonic);
            }}
            onCancel={() => this.props.history.push('/funding-options')}
            isLoading={this.state.isLoading}
          />
        );
    }
  }

  goTo(currentStep) {
    this.setState({
      currentStep,
    });
  }

  finishFlow = async mnemonic => {
    this.setState({isLoading: true});
    try {
      await walletClient.importSeed(this.state.passphrase, mnemonic);
      await this.props.completeInitialization(this.state.passphrase);
      await this.props.startWalletSync();
      await this.props.waitForWalletSync();
      await this.props.fetchWallet();
      await this.props.fetchTransactions();
    } catch (e) {
      this.props.showError(e.message);
      logger.error(`Error received from ImportSeedFlow - finishFlow]\n\n${e.message}\n${e.stack}\n`);
    } finally {
      this.setState({isLoading: false});
    }
  };
}

export default withRouter(
  connect(
    (state) => ({
      network: state.node.network,
    }),
    dispatch => ({
      completeInitialization: (passphrase) => dispatch(walletActions.completeInitialization(passphrase)),
      waitForWalletSync: () => dispatch(walletActions.waitForWalletSync()),
      startWalletSync: () => dispatch(walletActions.startWalletSync()),
      showError: (message) => dispatch(showError(message)),
      fetchWallet: () => dispatch(walletActions.fetchWallet()),
      fetchTransactions: () => dispatch(walletActions.fetchTransactions()),
    }),
  )(ImportSeedFlow),
);
