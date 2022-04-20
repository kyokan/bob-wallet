/* eslint-disable max-len */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import copy from 'copy-to-clipboard';
import { shell } from 'electron'
import './copy.scss';
import WizardHeader from '../../components/WizardHeader';
import {I18nContext} from "../../utils/i18n";

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

  static contextType = I18nContext;

  state = {
    copyWarningVisible: false,
    copied: false,
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

    const {copyWarningVisible, copied} = this.state;

    const {t} = this.context;

    return (
      <div className="create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        <div className="create-password__content">
          <div className="backup-warning__header_text">{t('backupWarningHeader')}</div>
          <div className="import_warning_text">
            {t('backupWarningText')}{' '}
            <span
              className="import-learn-more-text"
              onClick={() => shell.openExternal('https://en.bitcoinwiki.org/wiki/Mnemonic_phrase')}
            >
              {t('learnMore')}
            </span>
          </div>
          {copyWarningVisible ? (
            <div className="copy-seed__warning">
              {t(copied ? 'seedCopyDone' : 'seedCopyWarning')}{' '}
              {copied ? null : (
                <span
                  className="import-learn-more-text"
                  onClick={() => {
                    copy(seedphrase);
                    this.setState({ copied: true });
                  }}
                >
                  {t('copy')}
                </span>
              )}
            </div>
          ) : null}
          <div className="import-enter__textarea-container">
            <textarea
              className="import_enter_textarea"
              value={seedphrase}
              onClick={e => e.target.select()}
              onCopy={e => {
                e.preventDefault();
                this.setState({ copyWarningVisible: true, copied: false });
              }}
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
          <button className="extension_cta_button create_cta" onClick={onNext}>
            {t('backupConfirmText')}
          </button>
        </div>
      </div>
    );
  }
}
