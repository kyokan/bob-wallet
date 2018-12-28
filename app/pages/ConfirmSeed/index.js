/* eslint-disable max-len */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import './confirm-seed.scss';
import WizardHeader from '../../components/WizardHeader';

export default class ConfirmSeed extends Component {
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
    const { currentStep, totalSteps, onBack, onNext, onCancel } = this.props;

    return (
      <div className="create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={onCancel}
        />
        <div className="create-password__content">
          <div className="header_text">Confirm your recovery phrase</div>
          <div className="import_warning_text">
            Pasting is disabled to ensure that you have securely backed up your
            wallet on paper.
          </div>
          <div
            className={c('copy-seed__textarea', {
              'copy-seed__textarea--shake': this.state.pasteAttempted
            })}
          >
            <textarea
              placeholder="Enter your seed phrase"
              onKeyDown={this.handleKeyDown}
              onChange={e => this.setState({ words: e.target.value })}
              // onPaste={e => {
              //   e.preventDefault();
              //   this.setState({ pasteAttempted: true });
              //   setTimeout(() => this.setState({ pasteAttempted: false }), 1000);
              // }}
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
              if (this.state.words === this.props.seedphrase) {
                onNext();
              } else {
                this.setState({ pasteAttempted: true });
                setTimeout(
                  () => this.setState({ pasteAttempted: false }),
                  1000
                );
              }
            }}
          >
            Create New Wallet
          </button>
        </div>
      </div>
    );
  }
}
