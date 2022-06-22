import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import WizardHeader from '../../../components/WizardHeader/index';
import './importenter.scss';
import {I18nContext} from "../../../utils/i18n";

export default class ImportSeedEnterMnemonic extends Component {
  constructor(props) {
    super(props);

    this.state = {
      mnemonic: '',
      pasted: false,
    };
  }

  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
  };

  static contextType = I18nContext;

  onChangeMnemonic = e => {
    this.setState({
      mnemonic: e.target.value
    });
  };

  render() {
    const { currentStep, totalSteps, onBack, onNext } = this.props;
    const { pasted } = this.state;
    const {t} = this.context;
    const importPlaceholder = t('obImportSeedPlaceholder');

    return (
      <div className="create-password">
        <WizardHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          onBack={onBack}
          onCancel={this.props.onCancel}
        />
        <div className="create-password__content">
          <div className="backup-warning__header_text">{t('obImportSeedHeader')}</div>

          <div className="import_warning_text">
            {t('obImportSeedWarning')}
          </div>
          {pasted ? (
            <div className="confirm-seed__warning">
              {t('seedPasteWarning')}
            </div>
          ) : null}
          <div className="import-enter__textarea-container">
            <textarea
              className="import_enter_textarea"
              placeholder={importPlaceholder}
              value={this.state.mnemonic}
              onChange={this.onChangeMnemonic}
              onPaste={() => this.setState({ pasted: true })}
              autoFocus
            />
          </div>
        </div>
        <div
          className={classNames([
            'create-password__footer',
            'create-password__footer__removed-padding-top'
          ])}
        >
          <button
            className="extension_cta_button terms_cta"
            onClick={() => onNext(this.state.mnemonic)}
            disabled={this.disableButton() || this.props.isLoading}
          >
            { this.props.isLoading ? t('loading') : t('obImportSeedCTA') }
          </button>
        </div>
      </div>
    );
  }

  disableButton() {
    const length = this.state.mnemonic.trim().split(' ').length;
    return !(length === 12 || length === 24);
  }
}
