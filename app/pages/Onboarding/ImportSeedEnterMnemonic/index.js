import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import HDPrivateKey from 'hsd/lib/hd/private';
import WizardHeader from '../../../components/WizardHeader/index';
import './importenter.scss';
import {I18nContext} from "../../../utils/i18n";

@connect(
  (state) => ({
    network: state.wallet.network,
  })
)
class ImportSeedEnterMnemonic extends Component {
  constructor(props) {
    super(props);

    this.state = {
      input: '',
      pasted: false,
    };
  }

  static propTypes = {
    network: PropTypes.string.isRequired,
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    type: PropTypes.string.isRequired,
  };

  static contextType = I18nContext;

  onChangeMnemonic = e => {
    let input = '';

    switch (this.props.type) {
      case 'phrase':
        // Strip everything that isn't a letter or space
        input = e.target.value.replace(/[^a-z \u3000]/gi, '');
        break;

        case 'xpriv':
        // Strip everything that isn't alphanumeric
        input = e.target.value.replace(/[^a-z0-9]/gi, '');
        break;

      default:
        break;
    }

    this.setState({
      input,
    });
  };

  render() {
    const { currentStep, totalSteps, onBack, onNext, type } = this.props;
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
          <div className="backup-warning__header_text">
            {t(type === 'phrase' ? 'obImportSeedHeaderPhrase' : 'obImportSeedHeaderXpriv')}
          </div>

          <div className="import_warning_text">
            {t(type === 'phrase' ? 'obImportSeedWarningPhrase' : 'obImportSeedWarningXpriv')}
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
              value={this.state.input}
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
            onClick={() => onNext(this.state.input.trim())}
            disabled={this.disableButton() || this.props.isLoading}
          >
            { this.props.isLoading ? t('loading') : t('obImportSeedCTA') }
          </button>
        </div>
      </div>
    );
  }

  disableButton() {
    const {network, type} = this.props;
    const {input} = this.state;

    switch (type) {
      case 'phrase':
        const length = input.trim().split(/[\s\u3000]+/g).length;
        return !(length === 12 || length === 24);

      case 'xpriv':
        return !HDPrivateKey.isBase58(input.trim(), network);

      default:
        return true;
    }
  }
}

export default ImportSeedEnterMnemonic;
