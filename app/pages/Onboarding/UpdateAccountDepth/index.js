import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import WizardHeader from '../../../components/WizardHeader';
import "./update-account-depth.scss";

export default class UpdateAccountDepth extends Component {
  static propTypes = {
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      depth: 200,
      errorMessage: '',
      isChanging: false,
    };
  }

  updateAccountDepth = async () => {
    const { depth } = this.state;

    if (depth < 200) {
      this.setState({
        errorMessage: 'Account depth cannot be less than 200',
      });
      return;
    }

    this.props.onNext(depth);
  };

  renderMaybeChange() {
    const { errorMessage } = this.state;
    return (
      <div className="update-account-depth__content">
        <div className="update-account-depth__header_text">
          Do you want to change default account depth?
        </div>
        <div className="update-account-depth__subheader">
          Most users can safely keep default depth. A higher initial account depth configures your node to search for more transactions.
        </div>
        <div className="update-account-depth__error">
          {errorMessage}
        </div>
        <div className="update-account-depth__footer">
          <button
            className="extension_cta_button update-account-depth__secondary-cta"
            onClick={() => this.setState({ isChanging: true })}
          >
            Change Account Depth
          </button>
          <button
            className="extension_cta_button update-account-depth__cta"
            onClick={this.updateAccountDepth}
          >
            Keep Default Depth
          </button>
        </div>
      </div>
    )
  }

  renderChangeInput() {
    const { depth, errorMessage } = this.state;
    return (
      <div className="update-account-depth__content">
        <div className="update-account-depth__header_text">
          Set Initial Account Depth
        </div>
        <div className="update-account-depth__subheader">
          A higher initial account depth configures your node to search for more transactions. We recommend that power users set initial account depth to their wallet's total number of transactions, and round up to the nearest hundreds (e.g. set account depth to 1900 if your wallet has 1873 transactions).
        </div>
        <input
          className={c('update-account-depth__input', {
            'update-account-depth__input--error': errorMessage,
          })}
          min={200}
          step={1}
          pattern="[0-9]"
          onChange={e => this.setState({ depth: +e.target.value, errorMessage: '' })}
          value={depth}
        />
        <div className="update-account-depth__error">
          {errorMessage}
        </div>
        <div className="update-account-depth__footer">
          <button
            className="extension_cta_button update-account-depth__secondary-cta"
            onClick={() => this.setState({
              isChanging: false,
              depth: 200,
              errorMessage: '',
            })}
          >
            Cancel
          </button>
          <button
            className="extension_cta_button update-account-depth__cta"
            onClick={this.updateAccountDepth}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  render() {
    const { onBack, onCancel, currentStep, totalSteps } = this.props;
    const { isChanging } = this.state;

    return (
      <div className="update-account-depth">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        { isChanging ? this.renderChangeInput() : this.renderMaybeChange() }
      </div>
    );
  }
}
