import React, { Component } from 'react';
import PropTypes from 'prop-types';
import WizardHeader from '../../../components/WizardHeader';
import Checkbox from '../../../components/Checkbox';
import './opt-in-analytics.scss';
import {I18nContext} from "../../../utils/i18n";

export default class OptInAnalytics extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    isLoading: PropTypes.bool.isRequired,
  };

  static contextType = I18nContext;

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
    const {t} = this.context;

    return (
      <div className="opt-in-analytics">
        <WizardHeader currentStep={currentStep} totalSteps={totalSteps} onBack={onBack} onCancel={onCancel} />
        <div className="opt-in-analytics__content">
          <div className="opt-in-analytics__header-text">
            {t('obAnalyticsHeader')}
          </div>
          <div className="opt-in-analytics__body-text">
            {t('obAnalyticsBody')}
          </div>
          <div className="opt-in-analytics__checkbox-container">
            <Checkbox
              className="opt-in-analytics__checkbox"
              checked={this.state.optIn}
              onChange={this.toggleOptIn}
            />
            <span className="opt-in-analytics__checkbox-description">
              {t('obAnalyticsAck')}
            </span>
          </div>
        </div>
        <div className="opt-in-analytics__footer">
          <button
            className="extension_cta_button"
            onClick={() => this.props.onNext(this.state.optIn)}
            disabled={this.props.isLoading}
          >
            {this.props.isLoading ? t('obAnalyticsCreatingWallet') : t('next') }
          </button>
        </div>
      </div>
    );
  }
}
