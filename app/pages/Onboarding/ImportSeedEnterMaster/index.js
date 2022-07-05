import fs from 'fs';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import WizardHeader from '../../../components/WizardHeader/index';
import {I18nContext} from "../../../utils/i18n";
import './importenter.scss';


class ImportSeedEnterMaster extends Component {
  constructor(props) {
    super(props);

    this.state = {
      file: null,
      passphrase: '',
      error: '',
    };
  }

  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    type: PropTypes.string.isRequired,
  };

  static contextType = I18nContext;

  submitMaster = () => {
    const {onNext} = this.props;
    const {file, passphrase} = this.state;

    if (!file || !passphrase) return;
    if (file.type !== 'application/json') return;

    try {
      const fileContent = fs.readFileSync(file.path, 'utf-8');
      const json = JSON.parse(fileContent);

      this.validateMasterJSON(json);

      onNext({
        master: json,
        passphrase: passphrase,
      })
    } catch (error) {
      this.setState({error: error?.message || 'Error.'})
    }
  }

  render() {
    const {currentStep, totalSteps, onBack, onCancel} = this.props;
    const {error} = this.state;
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
            {t('obImportSeedHeaderMaster')}
          </div>

          <div className="import_warning_text">
            {t('obImportSeedWarningMaster')}
          </div>

          <div className="import-enter__inputs-container">
            {this.renderInputs()}
          </div>
        </div>

        {error && <div className="import-enter__error">{error}</div>}

        <div
          className={c([
            'create-password__footer',
            'create-password__footer__removed-padding-top'
          ])}
        >
          <button
            className="extension_cta_button terms_cta"
            onClick={() => this.submitMaster()}
            disabled={this.disableButton() || this.props.isLoading}
          >
            {this.props.isLoading ? t('loading') : t('obImportSeedCTA')}
          </button>
        </div>
      </div>
    );
  }

  renderInputs() {
    const {passphrase} = this.state;
    const {t} = this.context;

    return (
      <>
        {/* Master file select */}
        <div>
          <input
            type="file"
            accept="application/json"
            onChange={e => this.setState({file: e.target.files.item(0), error: ''})}
          />
        </div>

        {/* Password */}
        <div className="create-password__input">
          <input
            type="password"
            placeholder={t('obCreatePasswordPlaceholder')}
            value={passphrase}
            onChange={e => this.setState({passphrase: e.target.value})}
          />
        </div>
      </>
    )
  }

  disableButton() {
    const {file, passphrase} = this.state;
    return !file || !passphrase;
  }

  validateMasterJSON(json) {
    ['encrypted', 'iv', 'ciphertext', 'algorithm', 'n', 'r', 'p'].forEach(key => {
      if (json[key] === undefined) {
        throw new Error('Invalid master key: missing field: ' + key)
      }
    })
  }
}

export default ImportSeedEnterMaster;
