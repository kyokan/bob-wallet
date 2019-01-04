import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';

import ImportSeedWarning from '../ImportSeedWarning/index';
import CreatePassword from '../CreatePassword/index';
import ImportSeedEnterMnemonic from '../ImportSeedEnterMnemonic/index';
import Terms from '../Terms/index';
import * as walletActions from '../../../ducks/wallet';
import { importSeed } from '../../../utils/walletClient';

const TERM_OF_USE = 'TERM_OF_USE';
const WARNING_STEP = 'WARNING';
const CREATE_PASSWORD = 'CREATE_PASSWORD';
const ENTRY_STEP = 'ENTRY';

class ImportSeedFlow extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func
    }).isRequired,
    completeInitialization: PropTypes.func.isRequired
  };

  state = {
    currentStep: TERM_OF_USE,
    passphrase: ''
  };

  render() {
    switch (this.state.currentStep) {
      case TERM_OF_USE:
        return (
          <Terms
            onAccept={() => this.setState({ currentStep: WARNING_STEP })}
            onBack={() => this.props.history.push('/existing-options')}
          />
        );
      case WARNING_STEP:
        return (
          <ImportSeedWarning
            currentStep={1}
            totalSteps={3}
            onBack={() => this.goTo(TERM_OF_USE)}
            onNext={() => this.goTo(CREATE_PASSWORD)}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={2}
            totalSteps={3}
            onBack={() => this.setState({ currentStep: WARNING_STEP })}
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
            totalSteps={3}
            onBack={() => this.goTo(CREATE_PASSWORD)}
            onNext={this.finishFlow}
            onCancel={() => this.props.history.push('/funding-options')}
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
    try {
      await importSeed(this.state.passphrase, mnemonic);
      await this.props.completeInitialization();
    } catch (e) {
      console.error(e);
    }
  };
}

export default withRouter(
  connect(
    null,
    dispatch => ({
      completeInitialization: () =>
        dispatch(walletActions.completeInitialization())
    })
  )(ImportSeedFlow)
);
