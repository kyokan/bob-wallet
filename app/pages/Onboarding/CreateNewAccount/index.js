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
import '../ImportSeedEnterMnemonic/importenter.scss';
import '../ImportSeedWarning/importwarning.scss';
import walletClient from '../../../utils/walletClient';
import OptInAnalytics from '../OptInAnalytics';
import { clientStub as aClientStub } from '../../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

const TERMS_OF_USE = 0;
const CREATE_PASSWORD = 1;
const BACK_UP_SEED_WARNING = 2;
const COPY_SEEDPHRASE = 3;
const CONFIRM_SEEDPHRASE = 4;
const OPT_IN_ANALYTICS = 5;

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
    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            currentStep={0}
            totalSteps={4}
            onAccept={async () => {
              this.setState({
                currentStep: CREATE_PASSWORD,
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
            onBack={() => this.props.history.push('/funding-options')}
            onNext={async (passphrase) => {
              const optInState = await analytics.getOptIn();
              let currentStep = BACK_UP_SEED_WARNING;
              if (optInState === 'NOT_CHOSEN') {
                currentStep = OPT_IN_ANALYTICS;
              }

              this.setState({currentStep, passphrase});
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case OPT_IN_ANALYTICS:
        return (
          <OptInAnalytics
            currentStep={1}
            totalSteps={4}
            onBack={() => this.setState({currentStep: CREATE_PASSWORD})}
            onNext={async (optInState) => {
              await analytics.setOptIn(optInState);
              this.setState({currentStep: BACK_UP_SEED_WARNING});
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={2}
            totalSteps={4}
            onBack={() => this.setState({currentStep: CREATE_PASSWORD})}
            onNext={async () => {
              this.setState({isLoading: true});
              await walletClient.createNewWallet();
              const masterHDKey = await walletClient.getMasterHDKey();
              await walletClient.setPassphrase(this.state.passphrase);
              this.setState({currentStep: COPY_SEEDPHRASE, seedphrase: masterHDKey.mnemonic.phrase, isLoading: false});
            }}
            onCancel={() => this.props.history.push('/funding-options')}
            isLoading={this.state.isLoading}
          />
        );
      case COPY_SEEDPHRASE:
        return (
          <CopySeed
            currentStep={3}
            totalSteps={4}
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
            totalSteps={4}
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
      completeInitialization: (passphrase) => dispatch(walletActions.completeInitialization(passphrase)),
    }),
  )(CreateNewAccount),
);
