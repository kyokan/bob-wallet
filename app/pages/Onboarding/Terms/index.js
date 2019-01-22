import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
// import * as auctions.js from '../../../ducks/extension';
import './terms.scss';
import WizardHeader from '../../../components/WizardHeader';

export default class Terms extends Component {
  static propTypes = {
    onAccept: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
  };

  state = {
    hasAccepted: false
  };

  toggleTerms = () => this.setState({ hasAccepted: !this.state.hasAccepted });

  render() {
    const { onAccept, currentStep, totalSteps, onBack } = this.props;
    const { hasAccepted } = this.state;

    return (
      <div className="terms">
        <WizardHeader currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}/>
        <div className="terms__content">
          <div className="terms__header_text">Terms of Use</div>
          <div className="terms_subheader">
            Please review and agree to the Handshake wallet's terms of use.
          </div>
          <button
            className={c('terms__button', {
              'terms__button--accepted': hasAccepted
            })}
            onClick={this.toggleTerms}
          >
            <span>Terms of Use</span>
            <span className="directional_symbol terms_forward_arrow">
              <i className="right" />
            </span>
          </button>
          <button
            className="extension_cta_button terms_cta"
            onClick={onAccept}
            disabled={!hasAccepted}
          >
            I agree
          </button>
        </div>
      </div>
    );
  }
}
