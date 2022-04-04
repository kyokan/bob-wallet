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
import CreateMultisig from '../CreateMultisig/index';
import * as walletActions from '../../../ducks/walletActions';
import '../ImportSeedEnterMnemonic/importenter.scss';
import '../ImportSeedWarning/importwarning.scss';
import walletClient from '../../../utils/walletClient';
import OptInAnalytics from '../OptInAnalytics';
import { clientStub as aClientStub } from '../../../background/analytics/client';
import {I18nContext} from "../../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

const TERMS_OF_USE = 0;
const SET_NAME = 1;
const CREATE_PASSWORD = 2;
const OPT_IN_ANALYTICS = 3;
const BACK_UP_SEED_WARNING = 4;
const COPY_SEEDPHRASE = 5;
const CONFIRM_SEEDPHRASE = 6;
const LEDGER_CONNECT = 7;
const MULTISIG = 8;

class CreateNewAccount extends Component {
  static propTypes = {
    completeInitialization: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
    loc: PropTypes.string,
    walletsDetails: PropTypes.object.isRequired,
  };

  static contextType = I18nContext;

  state = {
    currentStep: TERMS_OF_USE,
    stepNumber: 1,
    name: '',
    seedphrase: '',
    passphrase: '',
    isLoading: false,
  };

  render() {
    // null, 'ledger', 'multisig'
    const variation = this.props.match.params.loc;

    let totalSteps = 6;
    switch (variation) {
      case 'ledger':
        totalSteps = 4;
        break;
      case 'multisig':
        break;
    }

    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            onAccept={() => this.setState({
              currentStep: SET_NAME,
              stepNumber: this.state.stepNumber + 1
            })}
            onBack={() => this.props.history.push('/funding-options')}
          />
        );
      case SET_NAME:
        return (
          <SetName
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            onBack={() => this.setState({
              currentStep: TERMS_OF_USE,
              stepNumber: this.state.stepNumber - 1
            })}
            onNext={(name) => {
              this.setState({
                currentStep: CREATE_PASSWORD,
                name,
                stepNumber: this.state.stepNumber + 1
            });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            onBack={() =>
              this.setState({
                currentStep: SET_NAME,
                stepNumber: this.state.stepNumber - 1
              })
            }
            onNext={async (passphrase) => {
              const optInState = await analytics.getOptIn();

              let currentStep = BACK_UP_SEED_WARNING;
              switch (variation) {
                case 'ledger':
                  currentStep = LEDGER_CONNECT;
                  break;
                case 'multisig':
                  currentStep = MULTISIG;
                  break;
              }

              if (optInState === 'NOT_CHOSEN') {
                currentStep = OPT_IN_ANALYTICS;
              }

              this.setState({
                currentStep,
                passphrase,
                stepNumber: this.state.stepNumber + 1
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case OPT_IN_ANALYTICS:
        return (
          <OptInAnalytics
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            onBack={() => this.setState({
              currentStep: CREATE_PASSWORD,
              stepNumber: this.state.stepNumber - 1
            })}
            onNext={async (optInState) => {
              await analytics.setOptIn(optInState);

              let currentStep = BACK_UP_SEED_WARNING;
              switch (variation) {
                case 'ledger':
                  currentStep = LEDGER_CONNECT;
                  break;
                case 'multisig':
                  currentStep = MULTISIG;
                  break;
              }

              this.setState({
                currentStep,
                stepNumber: this.state.stepNumber + 1
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case MULTISIG:
        return(
          <CreateMultisig
            walletName={this.state.name}
            passphrase={this.state.passphrase}
            onBack={() =>
              this.setState({
                currentStep: CREATE_PASSWORD,
                stepNumber: this.state.stepNumber - 1
              })
            }
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case LEDGER_CONNECT:
        return (
          <ConnectLedger
            walletName={this.state.name}
            passphrase={this.state.passphrase}
            onBack={() =>
              this.setState({
                currentStep: CREATE_PASSWORD,
                stepNumber: this.state.stepNumber - 1
              })
            }
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            onBack={() =>
              this.setState({
                currentStep: CREATE_PASSWORD,
                stepNumber: this.state.stepNumber - 1
              })
            }
            onNext={async () => {
              this.setState({ isLoading: true });
              const existingWallet = this.props.walletsDetails[this.state.name];
              if (existingWallet) {
                // Encrypt existing wallet
                await walletClient.encryptWallet(this.state.name, this.state.passphrase);
              } else {
                // Create new wallet
                await walletClient.createNewWallet(
                  this.state.name,
                  this.state.passphrase,
                  false, // isLedger
                  null,  // xpub (Ledger only)
                  1,     // m
                  1      // n
                );
              }
              const {phrase} = await walletClient.revealSeed(this.state.passphrase);

              this.setState({
                currentStep: COPY_SEEDPHRASE,
                seedphrase: phrase,
                isLoading: false,
                stepNumber: this.state.stepNumber + 1
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
            isLoading={this.state.isLoading}
          />
        );
      case COPY_SEEDPHRASE:
        return (
          <CopySeed
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({
              currentStep: BACK_UP_SEED_WARNING,
              stepNumber: this.state.stepNumber - 1
            })}
            onNext={() => this.setState({
              currentStep: CONFIRM_SEEDPHRASE,
              stepNumber: this.state.stepNumber + 1
            })}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CONFIRM_SEEDPHRASE:
        return (
          <ConfirmSeed
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({
              currentStep: COPY_SEEDPHRASE,
              stepNumber: this.state.stepNumber - 1
            })}
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
      network: state.wallet.network,
      walletsDetails: state.wallet.walletsDetails,
    }),
    (dispatch) => ({
      completeInitialization: (name, passphrase) =>
        dispatch(walletActions.completeInitialization(name, passphrase)),
    })
  )(CreateNewAccount)
);
