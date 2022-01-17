import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import Checkbox from '../../../components/Checkbox/index';
import WizardHeader from '../../../components/WizardHeader/index';
import './importwarning.scss';
import {I18nContext} from "../../../utils/i18n";

@withRouter
class ImportSeedWarning extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  state = {
    agreementConfirmed: false,
  };

  handleAgreementClick = () => {
    const agreement = this.state.agreementConfirmed;
    this.setState({agreementConfirmed: !agreement});
  };

  render() {
    const {agreementConfirmed} = this.state;
    const {currentStep, totalSteps} = this.props;
    const {t} = this.context;

    return (
      <div className="import-seed-warning create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={this.props.onBack}
          onCancel={this.props.onCancel}
        />
        <div className="create-password__content">
          <div className="backup-warning__header_text">{t('obImportWarningHeader')}</div>

          <div className="import_warning_text">
            <span>
              {t('obImportWarningText')}
            </span>
          </div>
          <div className="import_user_input">
            <span className="import_checkbox_container">
              <Checkbox
                checked={agreementConfirmed}
                onChange={this.handleAgreementClick}
              />
            </span>
            <span className="import_checkbox_text">
              {t('obImportWarningAckText')}
            </span>
          </div>
        </div>
        <div className="create-password__footer">
          <button
            className="extension_cta_button terms_cta"
            // className={classNames(['import_cta', agreementConfirmed ? 'import_cta_button__active' : 'import_cta_button'])}
            onClick={this.props.onNext}
            disabled={!agreementConfirmed}
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  }
}

export default ImportSeedWarning;
