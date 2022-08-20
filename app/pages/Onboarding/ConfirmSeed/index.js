/* eslint-disable max-len */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import './confirm-seed.scss';
import WizardHeader from '../../../components/WizardHeader';
import {I18nContext} from "../../../utils/i18n";

export default class ConfirmSeed extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    seedphrase: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
  };

  static contextType = I18nContext;

  state = {
    words: '',
    seedphraseNotMatching: false,
    pasted: false,
  };

  handleKeyDown = e => {
    if (e.key === 'Enter' || !/^[a-zA-Z ]+$/.test(e.key)) {
      e.preventDefault();
    }
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

    const {pasted} = this.state;

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
          <div className="backup-warning__header_text">
            {t('obConfirmSeedHeader')}
          </div>
          <div className="import_warning_text">
            {t('obConfirmSeedBody')}
          </div>
          {pasted ? (
            <div className="confirm-seed__warning">
              {t('seedPasteWarning')}
            </div>
          ) : null}
          <div
            className={c('import-enter__textarea-container', {
              'copy-seed__textarea--shake': this.state.seedphraseNotMatching
            })}
          >
            <textarea
              className="import_enter_textarea"
              placeholder={t('obConfirmSeedPlaceholder')}
              onKeyDown={this.handleKeyDown}
              onChange={e => this.setState({ words: e.target.value })}
              onPaste={() => this.setState({ pasted: true })}
              value={this.state.words}
              autoFocus
            />
          </div>
        </div>
        <div
          className={c([
            'create-password__footer',
            'create-password__footer__removed-padding-top'
          ])}
        >
          <button
            className="extension_cta_button create_cta"
            onClick={() => {
              if (this.state.words.trim() === seedphrase) {
                onNext();
              } else {
                this.setState({ seedphraseNotMatching: true });
                setTimeout(
                  () => this.setState({ seedphraseNotMatching: false }),
                  1000
                );
              }
            }}
            disabled={!this.state.words}
          >
            {t('obConfirmSeedCTA')}
          </button>
        </div>
      </div>
    );
  }
}
