import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';
import actions from '../../../ducks/extension';
import './importwarning.scss';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import Checkbox from '../../../components/Checkbox';
import WizardHeader from '../../../components/WizardHeader';

@connect(
  state => ({}),
  dispatch => ({
    actions: bindActionCreators(
      {
        setView: actions.setView,
      },
      dispatch,
    ),
  }),
)
@withRouter
export default class ImportSeedWarning extends Component {
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
    this.setState({ agreementConfirmed: !agreement });
  };

  render() {
    const { agreementConfirmed } = this.state;
    const { currentStep, totalSteps } = this.props;

    return (
      <div className="import-seed-warning create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={this.props.onBack}
          onCancel={this.props.onCancel}
        />
        <div className="create-password__content">
          <div className="header_text">Import your recovery seed phrase</div>

          <div className="import_warning_text">
            <span>
              Entering your seed on any website is dangerous. You could lose all
              your funds if you accidently visit a phishing website or if this
              extension is compromised.
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
              I understand I am selecting the least secure option.
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
            I Agree, Continue
          </button>
        </div>
      </div>
    );
  }
}
