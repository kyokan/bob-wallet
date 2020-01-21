import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import Checkbox from '../../../components/Checkbox/index';
import WizardHeader from '../../../components/WizardHeader/index';
import './importwarning.scss';

@withRouter
class ImportSeedWarning extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
  };

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

    return (
      <div className="import-seed-warning create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={this.props.onBack}
          onCancel={this.props.onCancel}
        />
        <div className="create-password__content">
          <div className="backup-warning__header_text">Import your recovery seed phrase</div>

          <div className="import_warning_text">
            <span>
              Entering your seed on any website is dangerous. You could lose all
              your funds if you accidentally visit a phishing website or if your
              computer is compromised.
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
              I understand the risks, let me enter my seed phrase.
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
            Continue
          </button>
        </div>
      </div>
    );
  }
}

export default ImportSeedWarning;
