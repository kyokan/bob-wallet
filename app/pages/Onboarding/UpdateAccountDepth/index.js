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
    };
  }

  updateAccountDepth = async () => {
    const { depth } = this.state;
    this.props.onNext(depth);
  };

  render() {
    const { onBack, onCancel, currentStep, totalSteps } = this.props;
    const { depth, errorMessage } = this.state;

    return (
      <div className="update-account-depth">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        <div className="update-account-depth__content">
          <div className="update-account-depth__header_text">
            Set Initial Account Depth
          </div>
          <div className="update-account-depth_subheader">
            We recommend setting your initial account depth to total number of transactions, and round up to the nearest 100.
          </div>
          <input
            className={c('update-account-depth__input', {
              'update-account-depth__input--error': errorMessage,
            })}
            onChange={e => this.setState({ depth: +e.target.value, errorMessage: '' })}
            value={depth}
          />
          <div className="create-password__error">
            {errorMessage}
          </div>
          <button
            className="extension_cta_button update-account-depth_cta"
            onClick={this.updateAccountDepth}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}
