import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Terms from '../Terms/index';
import CreatePassword from '../CreatePassword';
import BackUpSeedWarning from '../BackUpSeedWarning';
import CopySeed from '../CopySeed';
import ConfirmSeed from '../ConfirmSeed';
// import client from '../../utils/client';
// import { CREATE_WALLET } from '../../../../chrome/extension/background/actionTypes';
// import * as walletActions from '../../../ducks/wallet';
import { withRouter } from 'react-router-dom';

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
    address: ''
  };

  render() {
    switch (this.state.currentStep) {
      case TERMS_OF_USE:
        return (
          <Terms
            onAccept={() => this.setState({ currentStep: CREATE_PASSWORD })}
            onBack={() => this.props.history.push('/funding-options')}
          />
        );
      case CREATE_PASSWORD:
        return (
          <CreatePassword
            currentStep={1}
            totalSteps={3}
            onBack={() => this.setState({ currentStep: TERMS_OF_USE })}
            onNext={
              // WHEN REDUX IS SET UP:
              // delete the lines the upcoming lines and uncomment the part below
              () =>
                this.setState({
                  address: address,
                  seedphrase: seed,
                  currentStep: BACK_UP_SEED_WARNING
                })
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
            }
            onCancel={() => this.props.history.push('/funding-options')}
          />
        );
      case BACK_UP_SEED_WARNING:
        return (
          <BackUpSeedWarning
            currentStep={2}
            totalSteps={3}
            onBack={() => this.setState({ currentStep: CREATE_PASSWORD })}
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
              // await this.props.completeInitialization();
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

export default CreateNewAccount;
