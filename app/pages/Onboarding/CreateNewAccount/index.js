import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import {
  createNewWallet,
  generateReceivingAddress,
  getPublicKeyByAddress
} from '../../../utils/walletClient';
import Terms from '../Terms/index';
import CreatePassword from '../CreatePassword/index';
import BackUpSeedWarning from '../BackUpSeedWarning/index';
import CopySeed from '../../CopySeed/index';
import ConfirmSeed from '../ConfirmSeed/index';
// import client from '../../utils/client';
// import { CREATE_WALLET } from '../../../../chrome/extension/background/actionTypes';
// import * as walletActions from '../../../ducks/wallet';

//TEMP SOLUTION UNTIL IMPORT WARNING IS IMPLEMENTED
import '../ImportSeedEnterMnemonic/importenter.scss';
import '../ImportSeedWarning/importwarning.scss';

const TERMS_OF_USE = 0;
const CREATE_PASSWORD = 1;
const BACK_UP_SEED_WARNING = 2;
const COPY_SEEDPHRASE = 3;
const CONFIRM_SEEDPHRASE = 4;

// @connect(
//   null,
//   dispatch => ({
//     completeInitialization: () =>
//       dispatch(walletActions.completeInitialization())
//   })
// )
@withRouter
class CreateNewAccount extends Component {
  // static propTypes = {
  //   completeInitialization: PropTypes.func.isRequired
  // };

  state = {
    currentStep: TERMS_OF_USE,
    seedphrase: '',
    address: '',
    id: '143'
  };

  render() {
    const { id } = this.state;
    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            onAccept={async () => {
              const address = await getPublicKeyByAddress(
                'Michael1',
                'ss1qkla4rx7jpdw09vnnlmtuzwamrg97uvfgt32c4x'
              );
              console.log(address);
              // const newWallet = await WalletClient.createNewWallet(id);
              // const masterHDKey = await WalletClient.getMasterHDKey(id);
              this.setState({
                currentStep: BACK_UP_SEED_WARNING,
                seedphrase: masterHDKey.mnemonic.phrase
              });
            }}
            onBack={() => this.props.history.push('/funding-options')}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={1}
            totalSteps={4}
            onBack={() => this.setState({ currentStep: TERMS_OF_USE })}
            onNext={() => this.setState({ currentStep: COPY_SEEDPHRASE })}
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case COPY_SEEDPHRASE:
        return (
          <CopySeed
            currentStep={2}
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
            currentStep={3}
            totalSteps={4}
            seedphrase={this.state.seedphrase}
            onBack={() => this.setState({ currentStep: COPY_SEEDPHRASE })}
            onNext={() => this.setState({ currentStep: CREATE_PASSWORD })}
            // await this.props.completeInitialization();
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={3}
            totalSteps={4}
            onBack={() => this.setState({ currentStep: TERMS_OF_USE })}
            onNext={
              async password => {
                // const newWallet = await WalletClient.changePassphrase(
                //   this.state.id,
                //   password
                // );
                // const masterHDKey = await WalletClient.getMasterHDKey(id);
                // console.log(masterHDKey);
                this.props.history.push('/');
              }

              // WHEN REDUX IS SET UP:
              // password => {
              // client
              //   .dispatch({ type: CREATE_WALLET, payload: password })
              //   .then(({ address, seed }) => {
              //     this.setState({
              //       address: address,
              //       seedphrase: seed,
              //       currentStep: BACK_UP_SEED_WARNING
              //     });
              //   })
              //   .catch(console.error.bind(console));
              // }
            }
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      default:
        return <noscript />;
    }
  }
}

export default CreateNewAccount;
