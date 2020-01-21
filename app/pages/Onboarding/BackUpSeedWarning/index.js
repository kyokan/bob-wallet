import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import Checkbox from '../../../components/Checkbox/index';
import WizardHeader from '../../../components/WizardHeader';
import './index.scss';

@connect()
export default class BackUpSeedWarning extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
  };

  state = {
    hasAccepted: false
  };

  render() {
    const { currentStep, totalSteps, onBack, onNext, onCancel } = this.props;

    return (
      <div className="backup-warning">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        <div className="backup-warning__content">
          <div className="backup-warning__header_text">
            Back up your recovery seed phrase
          </div>
          <div className="backup-warning__body-text">
            Your seed phrase will be generated in the next screen. It will allow
            you to recover your wallet if lost, stolen, or compromised.
          </div>
          <div className="backup-warning__accept-container">
            <Checkbox
              className="backup-warning__check-box"
              onChange={e => this.setState({ hasAccepted: e.target.checked })}
              checked={this.state.hasAccepted}
            />
            <div className="backup-warning__check-box-description">
              I understand that if I lose my seed phrase, I will no longer be
              able to access my wallet.
            </div>
          </div>
        </div>
        <div className="create-password__footer">
          <button
            className='extension_cta_button'
            onClick={onNext}
            disabled={!this.state.hasAccepted || this.props.isLoading}
          >
            { this.props.isLoading ? 'Loading...' : 'I agree' }
          </button>
        </div>
      </div>
    );
  }
}
