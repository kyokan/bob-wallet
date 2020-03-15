/* eslint-disable max-len */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import './confirm-seed.scss';
import WizardHeader from '../../../components/WizardHeader';

export default class ConfirmSeed extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    seedphrase: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
  };

  state = {
    words: '',
    pasteAttempted: false
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
            Confirm your recovery phrase
          </div>
          <div className="import_warning_text">
            Type in your recovery words below. Pasting is disabled to ensure that you have securely backed up your
            wallet on paper.
          </div>
          <div
            className={c('import-enter__textarea-container', {
              'copy-seed__textarea--shake': this.state.pasteAttempted
            })}
          >
            <textarea
              className="import_enter_textarea"
              placeholder="Enter your seed phrase"
              onKeyDown={this.handleKeyDown}
              onChange={e => this.setState({ words: e.target.value })}
              onPaste={e => {
                e.preventDefault();
                this.setState({ pasteAttempted: true });
                setTimeout(() => this.setState({ pasteAttempted: false }), 1000);
              }}
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
                this.setState({ pasteAttempted: true });
                setTimeout(
                  () => this.setState({ pasteAttempted: false }),
                  1000
                );
              }
            }}
            disabled={!this.state.words}
          >
            Create New Wallet
          </button>
        </div>
      </div>
    );
  }
}
