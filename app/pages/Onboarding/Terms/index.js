import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
// import * as auctions.js from '../../../ducks/extension';
import WizardHeader from '../../../components/WizardHeader';
import Checkbox from "../../../components/Checkbox";
import TERMS_HTML from "./tos";
import "./terms.scss";

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
            Please review and agree to the Bob Wallet's terms of use.
          </div>
          <div
            className="terms__html-box"
            dangerouslySetInnerHTML={{
              __html: TERMS_HTML,
            }}
          />
          <div className="terms__input">
            <span className="import_checkbox_container">
              <Checkbox
                checked={hasAccepted}
                onChange={this.toggleTerms}
              />
            </span>
            <span className="import_checkbox_text">
              I accept the terms of use.
            </span>
          </div>
          <button
            className="extension_cta_button terms_cta"
            onClick={onAccept}
            disabled={!hasAccepted}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}
