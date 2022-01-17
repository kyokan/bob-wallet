import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import './create.scss';
import Submittable from '../../../components/Submittable';
import WizardHeader from '../../../components/WizardHeader';
import {I18nContext} from "../../../utils/i18n";

const HIGHLIGHT_ONLY = '$$HIGHLIGHT_ONLY$$';

@connect()
export default class CreatePassword extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      password: '',
      passwordError: '',
      passwordConfirmation: '',
      passwordConfirmationError: ''
    };
  }

  onSubmit = () => {
    const {t} = this.context;

    if (this.state.password.length < 8) {
      this.setState({
        passwordError: t('obCreatePasswordLengthError'),
        passwordConfirmationError: ''
      });
      return;
    }

    if (this.state.password !== this.state.passwordConfirmation) {
      this.setState({
        passwordError: HIGHLIGHT_ONLY,
        passwordConfirmationError: t('obCreatePasswordConfirmError')
      });
      return;
    }

    this.props.onNext(this.state.password);
  };

  isValidPassword = () => {
    return !(this.state.password.length < 8) && (this.state.password == this.state.passwordConfirmation)
  }

  onChange = name => e => {
    this.setState({
      [name]: e.target.value,
      passwordError: '',
      passwordConfirmationError: ''
    });
  };

  renderError(key) {
    const err = this.state[key];
    let msg = '';
    if (err && err !== HIGHLIGHT_ONLY) {
      msg = err;
    }

    return <div className="create-password__error">{msg}</div>;
  }

  render() {
    const { currentStep, totalSteps, onBack } = this.props;
    const {t} = this.context;

    return (
      <div className="create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={this.props.onCancel}
        />
        <div className="create-password__content">
          <Submittable onSubmit={this.onSubmit}>
            <div className="create-password__header_text">
              {t('obCreatePasswordHeader')}
            </div>
            <div className="create-password__body-text">
              {t('obCreatePasswordBody')}
            </div>
            <div
              className={c('create-password__input', {
                'create-password__input--error': this.state.passwordError
              })}
            >
              <input
                type="password"
                placeholder={t('obCreatePasswordPlaceholder')}
                value={this.state.password}
                onChange={this.onChange('password')}
                autoFocus
              />
            </div>
            {this.renderError('passwordError')}
            <div
              className={c('create-password__input', {
                'create-password__input--error': this.state
                  .passwordConfirmationError
              })}
            >
              <input
                type="password"
                placeholder={t('obCreatePasswordConfirmPlaceholder')}
                value={this.state.passwordConfirmation}
                onChange={this.onChange('passwordConfirmation')}
              />
            </div>
            {this.renderError('passwordConfirmationError')}
          </Submittable>
        </div>
        <div className="create-password__footer">
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={!this.isValidPassword()}
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  }
}
