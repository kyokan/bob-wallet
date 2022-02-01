import React, { Component } from 'react';
import PropTypes from 'prop-types';
import WizardHeader from '../../../components/WizardHeader';
import Checkbox from "../../../components/Checkbox";
import TERMS_HTML from "./tos";
import "./terms.scss";
import {I18nContext} from "../../../utils/i18n";

export default class Terms extends Component {
  static propTypes = {
    onAccept: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
  };

  static contextType = I18nContext;

  state = {
    hasAccepted: false
  };

  toggleTerms = () => this.setState({ hasAccepted: !this.state.hasAccepted });

  render() {
    const { onAccept, currentStep, totalSteps, onBack } = this.props;
    const { hasAccepted } = this.state;
    const {t} = this.context;

    return (
      <div className="terms">
        <WizardHeader currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}/>
        <div className="terms__content">
          <div className="terms__header_text">{t('obTermsHeader')}</div>
          <div className="terms_subheader">
            {t('obTermsBody')}
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
              {t('obTermsAck')}
            </span>
          </div>
          <button
            className="extension_cta_button terms_cta"
            onClick={onAccept}
            disabled={!hasAccepted}
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  }
}
