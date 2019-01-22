import React, { Component } from 'react';
import PropTypes from 'prop-types';
import StatusBar from '../StatusBar';
import './index.scss';

export default class WizardHeader extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onCancel: PropTypes.func,
    onBack: PropTypes.func,
    showStatusbar: PropTypes.bool,
  };

  render() {
    const {
      currentStep,
      totalSteps,
      onCancel,
      onBack,
      showStatusbar = true,
    } = this.props;

    return (
      <div className="wizard-header">
        <div className="wizard-header__navigation">
          {this.maybeRender(onBack, () => (
            <i
              className="arrow left clickable wizard-header__back"
              onClick={onBack}
            />
          ))}
        </div>
        {showStatusbar && (
          <div className="wizard-header__status-bar">
            <StatusBar currentStep={currentStep} totalSteps={totalSteps} />
          </div>
        )}
      </div>
    );
  }

  maybeRender(prop, cb) {
    if (!prop) {
      return null;
    }

    return cb();
  }
}
