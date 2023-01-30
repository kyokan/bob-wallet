import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import './select-wallet-type.scss';
import Submittable from '../../../components/Submittable';
import WizardHeader from '../../../components/WizardHeader';
import {I18nContext} from '../../../utils/i18n';
import Checkbox from '../../../components/Checkbox';

const HIGHLIGHT_ONLY = '$$HIGHLIGHT_ONLY$$';

@connect()
export default class SelectWalletType extends Component {
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
      isMultisig: false,
      m: '',
      n: '',
      mError: '',
      nError: ''
    };
  }

  onSubmit = () => {
    const {isMultisig, m, n} = this.state;
    const {t} = this.context;

    if (!isMultisig) {
      this.props.onNext(1, 1);
      return;
    }

    const mNum = parseInt(m);
    const nNum = parseInt(n);

    if (isNaN(mNum) || mNum <= 0) {
      this.setState({
        mError: t('obSelectWalletTypeErrorPositive'),
      });
      return;
    }
    if (isNaN(nNum) || nNum <= 0) {
      this.setState({
        nError: t('obSelectWalletTypeErrorPositive'),
      });
      return;
    }

    if (mNum > nNum) {
      this.setState({
        mError: t('obSelectWalletTypeErrorLimits'),
        nError: ''
      });
      return;
    }

    if (nNum > 15) {
      this.setState({
        nError: t('obSelectWalletTypeErrorLarge', 15),
      });
      return;
    }

    this.props.onNext(mNum, nNum);
    return;
  };

  isValid = () => {
    const {isMultisig, m, n} = this.state;

    if (!isMultisig) return true;
    if (!m || !n) return false;
    return true;
  }

  onChange = name => e => {
    this.setState({
      [name]: e.target.value,
      mError: '',
      nError: ''
    });
  };

  renderError(key) {
    const err = this.state[key];
    let msg = '';
    if (err && err !== HIGHLIGHT_ONLY) {
      msg = err;
    }

    return <div className="swt__error">{msg}</div>;
  }

  render() {
    const {t} = this.context;
    const {currentStep, totalSteps, onBack, onCancel} = this.props;
    const {mError, nError, isMultisig, m, n} = this.state;

    return (
      <div className="swt">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        <div className="swt__content">
          <Submittable onSubmit={this.onSubmit}>
            <div className="swt__header-text">
              {t('obSelectWalletTypeTitle')}
            </div>
            <div className="swt__body-text">
              {t('obSelectWalletTypeBody1')}<br />
              {t('obSelectWalletTypeBody2')}
            </div>

            <div className="swt__input checkbox-wrapper">
              <span className="import_checkbox_container">
                <Checkbox
                  checked={isMultisig}
                  onChange={() => this.setState({isMultisig: !isMultisig})}
                />
              </span>
              <span className="import_checkbox_text">
                {t('obSelectWalletTypeCheckbox')}
              </span>
            </div>

            {isMultisig &&
              <>
                <div className="swt__input-container">
                  <div
                    className={c('swt__input', {
                      'swt__input--error': mError
                    })}
                  >
                    <input
                      type="number"
                      placeholder={t('obSelectWalletTypeMinimum')}
                      min={1}
                      max={15}
                      value={m}
                      onChange={this.onChange('m')}
                    />
                  </div>

                  <span>of</span>

                  <div
                    className={c('swt__input', {
                      'swt__input--error': nError
                    })}
                  >
                    <input
                      type="number"
                      placeholder={t('obSelectWalletTypeTotal')}
                      min={1}
                      max={15}
                      value={n}
                      onChange={this.onChange('n')}
                    />
                  </div>
                  <span>{t('obSelectWalletTypeSignatures')}</span>
                </div>
                {this.renderError('mError')}
                {this.renderError('nError')}
              </>
            }
          </Submittable>
        </div>
        <div className="swt__footer">
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={!this.isValid()}
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  }
}
