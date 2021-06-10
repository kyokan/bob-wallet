import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import Terms from '../Terms/index';
import CreatePassword from '../CreatePassword/index';
import ConnectLedger from "../ConnectLedger/index";
import BackUpSeedWarning from '../BackUpSeedWarning/index';
import CopySeed from '../../CopySeed/index';
import ConfirmSeed from '../ConfirmSeed/index';
import SetName from '../SetName/index';
import * as walletActions from '../../../ducks/walletActions';
import '../ImportSeedEnterMnemonic/importenter.scss';
import '../ImportSeedWarning/importwarning.scss';
import walletClient from '../../../utils/walletClient';
import OptInAnalytics from '../OptInAnalytics';
import { clientStub as aClientStub } from '../../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

const TERMS_OF_USE = 0;
const SET_NAME = 1;
const CREATE_PASSWORD = 2;
const OPT_IN_ANALYTICS = 3;
const BACK_UP_SEED_WARNING = 4;
const COPY_SEEDPHRASE = 5;
const CONFIRM_SEEDPHRASE = 6;
const LEDGER_CONNECT = 7;

class CreateNewAccount extends Component {
  static propTypes = {
    completeInitialization: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
    loc: PropTypes.string,
  };

  state = {
    currentStep: TERMS_OF_USE,
    name: '',
    seedphrase: '',
    passphrase: '',
    isLoading: false,
  };

  render() {
    const totalSteps = this.props.match.params.loc === 'ledger' ? 4 : 6;

    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            currentStep={0}
            totalSteps={totalSteps}
            onAccept={() => this.setState({currentStep: SET_NAME})}
            onBack={() => this.props.history.push('/funding-options')}
          />
        );
      case SET_NAME:
        return (
          <SetName
            currentStep={1}
            totalSteps={totalSteps}
            onBack={() => this.setState({currentStep: TERMS_OF_USE})}
            onNext={(name) => {
              this.setState({currentStep: CREATE_PASSWORD, name});
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={2}
            totalSteps={totalSteps}
            onBack={() =>
              this.setState({
                currentStep: SET_NAME,
              })
            }
            onNext={async (passphrase) => {
              const optInState = await analytics.getOptIn();
              let currentStep =
                this.props.match.params.loc === 'ledger'
                  ? LEDGER_CONNECT
                  : BACK_UP_SEED_WARNING;
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
            currentStep={3}
            totalSteps={totalSteps}
            onBack={() => this.setState({currentStep: CREATE_PASSWORD})}
            onNext={async (optInState) => {
              await analytics.setOptIn(optInState);
              this.setState({
                currentStep:
                  this.props.match.params.loc === 'ledger'
                    ? LEDGER_CONNECT
                    : BACK_UP_SEED_WARNING,
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case LEDGER_CONNECT:
        return (
          <ConnectLedger
            walletName={this.state.name}
            passphrase={this.state.passphrase}
            onBack={() =>
              this.setState({ currentStep: CREATE_PASSWORD })
            }
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={4}
            totalSteps={totalSteps}
            onBack={() =>
              this.setState({ currentStep: CREATE_PASSWORD })
            }
            onNext={async () => {
              this.setState({ isLoading: true });
              await walletClient.createNewWallet(this.state.name);
              const masterHDKey = await walletClient.getMasterHDKey();
              await walletClient.setPassphrase(this.state.passphrase);
              this.setState({
                currentStep: COPY_SEEDPHRASE,
                seedphrase: masterHDKey.mnemonic.phrase,
                isLoading: false,
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
            isLoading={this.state.isLoading}
          />
        );
      case COPY_SEEDPHRASE:
        return (
          <CopySeed
            currentStep={5}
            totalSteps={totalSteps}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({ currentStep: BACK_UP_SEED_WARNING })}
            onNext={() => this.setState({ currentStep: CONFIRM_SEEDPHRASE })}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CONFIRM_SEEDPHRASE:
        return (
          <ConfirmSeed
            currentStep={6}
            totalSteps={totalSteps}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({ currentStep: COPY_SEEDPHRASE })}
            onNext={async () => {
              await this.props.completeInitialization(
                this.state.name,
                this.state.passphrase
              );
              this.props.history.push('/account');
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
    (dispatch) => ({
      completeInitialization: (name, passphrase) =>
        dispatch(walletActions.completeInitialization(name, passphrase)),
    })
  )(CreateNewAccount)
);
