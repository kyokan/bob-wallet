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
    name: '',
    m: null,
    n: null,
    seedphrase: '',
    passphrase: '',
    isLoading: false,
  };

  goTo(currentStep) {
    this.setState({
      currentStep,
    });
  }

  render() {
    // null, 'ledger'
    const variation = this.props.match.params.loc;
    const {currentStep} = this.state;

    const totalSteps = variation === 'ledger' ? 5 : 7;

    switch (currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            currentStep={currentStep}
            totalSteps={totalSteps}
            onAccept={() => this.goTo(SET_NAME)}
            onBack={() => this.props.history.push('/funding-options')}
          />
        );
      case SET_NAME:
        return (
          <SetName
            currentStep={currentStep}
            totalSteps={totalSteps}
            onBack={() => this.goTo(TERMS_OF_USE)}
            onNext={(name) => {
              this.setState({
                currentStep: SELECT_WALLET_TYPE,
                name,
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case SELECT_WALLET_TYPE:
        return (
          <SelectWalletType
            currentStep={currentStep}
            totalSteps={totalSteps}
            onBack={() => this.goTo(SET_NAME)}
            onNext={async (m, n) => {
              this.setState({
                currentStep: CREATE_PASSWORD,
                m, n,
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={currentStep}
            totalSteps={totalSteps}
            onBack={() => this.goTo(SELECT_WALLET_TYPE)}
            onNext={async (passphrase) => {
              let currentStep = BACK_UP_SEED_WARNING;
              if (variation === 'ledger') {
                currentStep = LEDGER_CONNECT;
              }
              const optInState = await analytics.getOptIn();
              if (optInState === 'NOT_CHOSEN') {
                currentStep = OPT_IN_ANALYTICS;
              }

              this.setState({
                currentStep,
                passphrase,
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case OPT_IN_ANALYTICS:
        return (
          <OptInAnalytics
            currentStep={currentStep}
            totalSteps={totalSteps}
            onBack={() => this.goTo(CREATE_PASSWORD)}
            onNext={async (optInState) => {
              await analytics.setOptIn(optInState);
              const next = variation === 'ledger'
                ? LEDGER_CONNECT : BACK_UP_SEED_WARNING;
              this.goTo(next);
            }}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case LEDGER_CONNECT:
        return (
          <ConnectLedger
            walletName={this.state.name}
            passphrase={this.state.passphrase}
            onBack={() => this.goTo(CREATE_PASSWORD)}
            onCancel={() => this.props.history.push('/funding-options')}
            walletM={this.state.m}
            walletN={this.state.n}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={currentStep}
            totalSteps={totalSteps}
            onBack={() => this.goTo(CREATE_PASSWORD)}
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
              });
            }}
            onCancel={() => this.props.history.push('/funding-options')}
            isLoading={this.state.isLoading}
          />
        );
      case COPY_SEEDPHRASE:
        return (
          <CopySeed
            currentStep={currentStep}
            totalSteps={totalSteps}
            seedphrase={this.state.seedphrase}
            onBack={() => this.goTo(BACK_UP_SEED_WARNING)}
            onNext={() => this.goTo(CONFIRM_SEEDPHRASE)}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CONFIRM_SEEDPHRASE:
        return (
          <ConfirmSeed
            currentStep={currentStep}
            totalSteps={totalSteps}
            seedphrase={this.state.seedphrase}
            onBack={() => this.goTo(COPY_SEEDPHRASE)}
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
