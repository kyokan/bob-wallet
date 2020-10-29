import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import './create.scss';
import Submittable from '../../../components/Submittable';
import WizardHeader from '../../../components/WizardHeader';
import walletClient from "../../../utils/walletClient";

@connect(
  (state) => ({
    wallets: state.wallet.wallets,
  })
)
export default class CreatePassword extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    wallets: PropTypes.arrayOf(PropTypes.string).isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      name: '',
      errorMessage: '',
    };
  }

  onSubmit = async () => {
    if (this.isValidName()) {
      const allWallets = await walletClient.listWallets(true);
      const {wallets} = this.props;
      const {name} = this.state;
      let errorMessage = '';

      if (wallets.includes(name)) {
        errorMessage = `"${name}" already exists`;
      } else if (allWallets.includes(name)) {
        errorMessage = `cannot use "${name}" as name`;
      }

      if (errorMessage) {
        this.setState({
          errorMessage,
        });
        return;
      }

      this.props.onNext(name);
    }
  };

  isValidName = () => {
    const {errorMessage, name} = this.state;
    return !errorMessage && name.match(/^[a-z0-9]+$/);
  };

  onChange = (name) => async (e) => {
    const {wallets} = this.props;
    const inputValue = e.target.value;

    let errorMessage = '';

    if (wallets.includes(inputValue)) {
      errorMessage = `"${inputValue}" already exists`;
    }

    this.setState({
      [name]: inputValue,
      errorMessage: errorMessage,
    });
  };

  render() {
    const {currentStep, totalSteps, onBack} = this.props;
    const {errorMessage} = this.state;

    return (
      <div className="create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={this.props.onCancel}
        />
        <div className="create-password__content">
          <Submittable onSubmit={this.onSubmit}>
            <div className="create-password__header_text">
              Name this wallet
            </div>
            <div className="create-password__body-text">
              The name can only contain alphanumeric lowercase characters.
            </div>
            <div
              className={c('create-password__input', {
                'create-password__input--error': errorMessage,
              })}
            >
              <input
                type="text"
                placeholder="Enter a name"
                value={this.state.name}
                onChange={this.onChange('name')}
                autoFocus
              />
            </div>
            <div className="create-password__error">
              {errorMessage}
            </div>
          </Submittable>
        </div>
        <div className="create-password__footer">
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={!this.isValidName()}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}
