/* eslint-disable max-len */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import './copy.scss';
import WizardHeader from '../../components/WizardHeader';

@connect()
export default class CopySeed extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    seedphrase: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
  };

  static defaultProps = {
    seedphrase:
      'witch collapse practice feed shame open despair creek road again ice least'
  };

  render() {
    const {
      currentStep,
      totalSteps,
      onBack,
      onNext,
      onCancel,
      seedphrase
    } = this.props;

    return (
      <div className="create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        <div className="create-password__content">
          <div className="header_text">Your Recovery Seed Phrase</div>
          <div className="import_warning_text">
            Write down these 24 words on paper and keep it safe and secure. Do
            not email or screenshot your seed.
          </div>
          <div className="import-learn-more-text">Learn more</div>
          <div className="import-enter__textarea-container">
            <textarea
              className="import_enter_textarea"
              value={seedphrase}
              onClick={e => e.target.select()}
              readOnly
            />
          </div>
        </div>
        <div
          className={classNames([
            'create-password__footer',
            'create-password__footer__removed-padding-top'
          ])}
        >
          <button className="extension_cta_button terms_cta" onClick={onNext}>
            I've copied this somewhere safe
          </button>
        </div>
      </div>
    );
  }
}