import React, { Component } from 'react';
import PropTypes from 'prop-types';
import WizardHeader from '../../../components/WizardHeader';
import Checkbox from '../../../components/Checkbox';
import './opt-in-analytics.scss';

export default class OptInAnalytics extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    isLoading: PropTypes.bool.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      optIn: false,
    };
  }

  toggleOptIn = () => {
    this.setState({
      optIn: !this.state.optIn,
    });
  };

  render() {
    const {currentStep, totalSteps, onBack, onCancel} = this.props;

    return (
      <div className="opt-in-analytics">
        <WizardHeader currentStep={currentStep} totalSteps={totalSteps} onBack={onBack} onCancel={onCancel} />
        <div className="opt-in-analytics__content">
          <div className="opt-in-analytics__header-text">
            Opt in to analytics
          </div>
          <div className="opt-in-analytics__body-text">
            Do you want to send anonymous usage data to Kyokan?
          </div>
          <div className="opt-in-analytics__checkbox-container">
            <Checkbox
              className="opt-in-analytics__checkbox"
              checked={this.state.optIn}
              onChange={this.toggleOptIn}
            />
            <span className="opt-in-analytics__checkbox-description">
              Yes, opt me in
            </span>
          </div>
        </div>
        <div className="opt-in-analytics__footer">
          <button
            className="extension_cta_button"
            onClick={() => this.props.onNext(this.state.optIn)}
            disabled={this.props.isLoading}
          >
            {this.props.isLoading ? 'Creating wallet...' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }
}
