import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import Terms from '../Terms/index';
import CreatePassword from '../CreatePassword/index';
import BackUpSeedWarning from '../BackUpSeedWarning/index';
import CopySeed from '../../CopySeed/index';
import ConfirmSeed from '../ConfirmSeed/index';
import * as walletActions from '../../../ducks/walletActions';
//TEMP SOLUTION UNTIL IMPORT WARNING IS IMPLEMENTED
import '../ImportSeedEnterMnemonic/importenter.scss';
import '../ImportSeedWarning/importwarning.scss';
import * as walletClient from '../../../utils/walletClient';

const TERMS_OF_USE = 0;
const CREATE_PASSWORD = 1;
const BACK_UP_SEED_WARNING = 2;
const COPY_SEEDPHRASE = 3;
const CONFIRM_SEEDPHRASE = 4;

class CreateNewAccount extends Component {
  static propTypes = {
    completeInitialization: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
  };

  state = {
    currentStep: CREATE_PASSWORD,
    seedphrase: '',
    pasphrase: '',
    isLoading: false,
  };

  render() {
    const client = walletClient.forNetwork(this.props.network);

    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            currentStep={0}
            totalSteps={5}
            onAccept={async () => {
              this.setState({
                currentStep: CREATE_PASSWORD
              });
            }}
            onBack={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={1}
            totalSteps={5}
            onBack={() => this.props.history.push('/funding-options')}
            onNext={async passphrase => {
              this.setState({currentStep: BACK_UP_SEED_WARNING, passphrase});
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={2}
            totalSteps={5}
            onBack={() => this.setState({currentStep: CREATE_PASSWORD})}
            onNext={async () => {
              this.setState({isLoading: true}) 
              await client.createNewWallet();
              const masterHDKey = await client.getMasterHDKey();
              await client.setPassphrase(this.state.passphrase);
              this.setState({currentStep: COPY_SEEDPHRASE, seedphrase: masterHDKey.mnemonic.phrase, isLoading: false})
            }}
            onCancel={() => this.props.history.push('/funding-options')}
            isLoading={this.state.isLoading}
          />
        );
      case COPY_SEEDPHRASE:
        return (
          <CopySeed
            currentStep={3}
            totalSteps={5}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({currentStep: BACK_UP_SEED_WARNING})}
            onNext={() => this.setState({currentStep: CONFIRM_SEEDPHRASE})}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CONFIRM_SEEDPHRASE:
        return (
          <ConfirmSeed
            currentStep={4}
            totalSteps={5}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({currentStep: COPY_SEEDPHRASE})}
            onNext={async () => {
              await this.props.completeInitialization(this.state.passphrase);
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
    (state) => ({
      network: state.node.network,
    }),
    dispatch => ({
      completeInitialization: (passphrase) => dispatch(walletActions.completeInitialization(passphrase))
    })
  )(CreateNewAccount)
);
