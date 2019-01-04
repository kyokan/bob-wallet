import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import {
  createNewWallet,
  getPublicKeyByAddress,
  getMasterHDKey,
  createPassphrase
} from '../../../utils/walletClient';
import Terms from '../Terms/index';
import CreatePassword from '../CreatePassword/index';
import BackUpSeedWarning from '../BackUpSeedWarning/index';
import CopySeed from '../../CopySeed/index';
import ConfirmSeed from '../ConfirmSeed/index';
import * as walletActions from '../../../ducks/wallet';

//TEMP SOLUTION UNTIL IMPORT WARNING IS IMPLEMENTED
import '../ImportSeedEnterMnemonic/importenter.scss';
import '../ImportSeedWarning/importwarning.scss';

const TERMS_OF_USE = 0;
const CREATE_PASSWORD = 1;
const BACK_UP_SEED_WARNING = 2;
const COPY_SEEDPHRASE = 3;
const CONFIRM_SEEDPHRASE = 4;

class CreateNewAccount extends Component {
  static propTypes = {
    completeInitialization: PropTypes.func.isRequired
  };

  state = {
    currentStep: TERMS_OF_USE,
    seedphrase: ''
  };

  render() {
    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            onAccept={async () => {
              const unencryptedWallet = await createNewWallet();
              const masterHDKey = await getMasterHDKey();
              this.setState({
                currentStep: CREATE_PASSWORD,
                seedphrase: masterHDKey.mnemonic.phrase
              });
            }}
            onBack={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={1}
            totalSteps={4}
            onBack={() => this.setState({ currentStep: TERMS_OF_USE })}
            onNext={async password => {
              const newWallet = await createPassphrase(password);
              this.setState({ currentStep: BACK_UP_SEED_WARNING });
              console.log(this.state);
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={2}
            totalSteps={4}
            onBack={() => this.setState({ currentStep: TERMS_OF_USE })}
            onNext={() => this.setState({ currentStep: COPY_SEEDPHRASE })}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case COPY_SEEDPHRASE:
        return (
          <CopySeed
            currentStep={3}
            totalSteps={4}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({ currentStep: BACK_UP_SEED_WARNING })}
            onNext={() => this.setState({ currentStep: CONFIRM_SEEDPHRASE })}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CONFIRM_SEEDPHRASE:
        return (
          <ConfirmSeed
            currentStep={4}
            totalSteps={4}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({ currentStep: COPY_SEEDPHRASE })}
            onNext={async () => {
              await this.props.completeInitialization();
              this.props.history.push('/');
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      default:
        return <noscript />;
    }
  }
}

export default withRouter(
  connect(
    null,
    dispatch => ({
      completeInitialization: () =>
        dispatch(walletActions.completeInitialization())
    })
  )(CreateNewAccount)
);
