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
import SelectWalletType from '../SelectWalletType/index';
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
const SELECT_WALLET_TYPE = 2;
const CREATE_PASSWORD = 3;
const OPT_IN_ANALYTICS = 4;
const BACK_UP_SEED_WARNING = 5;
const COPY_SEEDPHRASE = 6;
const CONFIRM_SEEDPHRASE = 7;
const LEDGER_CONNECT = 8;

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
    m: null,
    n: null,
    seedphrase: '',
    passphrase: '',
    isLoading: false,
  };

  render() {
    // null, 'ledger'
    const variation = this.props.match.params.loc;

    let totalSteps = 7;
    switch (variation) {
      case 'ledger':
        totalSteps = 5;
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
                currentStep: SELECT_WALLET_TYPE,
                name,
                stepNumber: this.state.stepNumber + 1
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case SELECT_WALLET_TYPE:
        return (
          <SelectWalletType
            currentStep={this.state.stepNumber}
            totalSteps={totalSteps}
            onBack={() =>
              this.setState({
                currentStep: SET_NAME,
                stepNumber: this.state.stepNumber - 1
              })
            }
            onNext={async (m, n) => {
              this.setState({
                currentStep: CREATE_PASSWORD,
                m, n,
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
                currentStep: SELECT_WALLET_TYPE,
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
              }

              this.setState({
                currentStep,
                stepNumber: this.state.stepNumber + 1
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
              this.setState({
                currentStep: CREATE_PASSWORD,
                stepNumber: this.state.stepNumber - 1
              })
            }
            onCancel={() => this.props.history.push('/funding-options')}
            walletM={this.state.m}
            walletN={this.state.n}
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
                  this.state.m,
                  this.state.n,
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
