import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';

import ImportSeedWarning from '../ImportSeedWarning/index';
import CreatePassword from '../CreatePassword/index';
import ImportSeedEnterMnemonic from '../ImportSeedEnterMnemonic/index';
import Terms from '../Terms/index';
import * as walletActions from '../../../ducks/walletActions';
import *as walletClient from '../../../utils/walletClient';
import * as logger from '../../../utils/logClient';

const TERM_OF_USE = 'TERM_OF_USE';
const WARNING_STEP = 'WARNING';
const CREATE_PASSWORD = 'CREATE_PASSWORD';
const ENTRY_STEP = 'ENTRY';

class ImportSeedFlow extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func
    }).isRequired,
    completeInitialization: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
  };

  state = {
    // temporarily skip TOU until we have one from legal
    currentStep: WARNING_STEP,
    passphrase: '',
    isLoading: false,
  };

  render() {
    switch (this.state.currentStep) {
      case TERM_OF_USE:
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
                currentStep: ENTRY_STEP
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
            onNext={this.finishFlow}
            onCancel={() => this.props.history.push('/funding-options')}
            isLoading={this.state.isLoading}
          />
        );
    }
  }

  goTo(currentStep) {
    this.setState({
      currentStep
    });
  }

  finishFlow = async mnemonic => {
    this.setState({isLoading: true})
    try {
      await walletClient.forNetwork(this.props.network).importSeed(this.state.passphrase, mnemonic);
      await this.props.completeInitialization(this.state.passphrase);
    } catch (e) {
      logger.error(`Error received from ImportSeedFlow - finishFlow]\n\n${e.message}\n${e.stack}\n`);
    } finally {
      this.setState({isLoading: false})
    }
  };
}

export default withRouter(
  connect(
    (state) => ({
      network: state.node.network,
    }),
    dispatch => ({
      completeInitialization: (passphrase) => dispatch(walletActions.completeInitialization(passphrase))
    })
  )(ImportSeedFlow)
);
