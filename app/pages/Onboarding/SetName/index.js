import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import './create.scss';
import Submittable from '../../../components/Submittable';
import WizardHeader from '../../../components/WizardHeader';
import walletClient from "../../../utils/walletClient";
import {I18nContext} from "../../../utils/i18n";

@connect(
  (state) => ({
    wallets: state.wallet.wallets,
  })
)
export default class SetName extends Component {
  static propTypes = {
    currentStep: PropTypes.number.isRequired,
    totalSteps: PropTypes.number.isRequired,
    wallets: PropTypes.arrayOf(PropTypes.string).isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      name: '',
      errorMessage: '',
      multisigWallet: false,
      multisigM: '',
      multisigN: ''
    };
  }

  onSubmit = async () => {
    const {t} = this.context;

    if (this.isValidName()) {
      const allWallets = await walletClient.listWallets(true);
      const {wallets} = this.props;
      const {name} = this.state;
      let errorMessage = '';

      if (wallets.includes(name)) {
        errorMessage = t('obSetNameAlreadyExistError', name);
      } else if (allWallets.includes(name)) {
        errorMessage = t('obSetNameCannotUseError', name);
      }

      var m = null;
      var n = null;

      if (this.state.multisigWallet) {
        try {
          if(!(/[0-9]+/.test(this.state.multisigM)) || !(/[0-9]+/.test(this.state.multisigN))) {
            throw 'invalid format for m/n';
          }

          m = parseInt(this.state.multisigM);
          n = parseInt(this.state.multisigN);

          if(m <= 1 || n <= 0 || m >= n) {
            errorMessage = t('obSetNameMultiSigMNError');
          }
        }
        catch(e) {
          errorMessage = t('obSetNameMultiSigWrongFormat');
        }
      }

      if (errorMessage) {
        this.setState({
          errorMessage,
        });
        return;
      }

      this.props.onNext(name, m, n);
    }
  };

  isValidName = () => {
    const {errorMessage, name} = this.state;
    return !errorMessage && name.match(/^[a-z0-9]+$/) && name !== 'primary';
  };

  onChange = (name) => async (e) => {
    const {wallets} = this.props;
    const inputValue = e.target.value;
    const {t} = this.context;

    let errorMessage = '';

    if (inputValue === 'primary') {
      errorMessage = t('obSetNameCannotUseError', inputValue);
    } else if (wallets.includes(inputValue)) {
      errorMessage = t('obSetNameAlreadyExistError', inputValue);
    }

    this.setState({
      [name]: inputValue,
      errorMessage: errorMessage,
    });
  };

  render() {
    const {currentStep, totalSteps, onBack} = this.props;
    const {errorMessage} = this.state;
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
            <div className="create-password__error">
              {errorMessage}
            </div>
            <div className="create-password__header_text">
              {t('obSetNameHeader')}
            </div>
            <div className="create-password__body-text">
              {t('obSetNameBody')}
            </div>
            <div
              className={c('create-password__input', {
                'create-password__input--error': errorMessage,
              })}
            >
              <input
                type="text"
                placeholder={t('obSetNamePlaceholder')}
                value={this.state.name}
                onChange={this.onChange('name')}
                autoFocus
              />
            </div>
            <div>
              <input
                checked={this.state.multisigWallet}
                onChange={(e) => this.setState({'multisigWallet': e.target.checked, multisigM: '', multisigN: ''})}
                type="checkbox"/>
                <span>{t('obCreateMultisigOption')}</span>
              {this.state.multisigWallet ?
                <div>
                  <br/>
                  <span>M: </span>
                  <div
                    className={c('create-password__input', {
                      'create-password__input--error': errorMessage,
                    })}>
                    <input type="text" placeholder={t('obSetNameMultisigM')}
                      value={this.state.multisigM}
                      onChange={this.onChange('multisigM')}
                      />
                  </div>
                  <span>N: </span>
                  <div
                    className={c('create-password__input', {
                      'create-password__input--error': errorMessage,
                    })}>
                    <input type="text" placeholder={t('obSetNameMultisigN')}
                      value={this.state.multisigN}
                      onChange={this.onChange('multisigN')}
                      />
                  </div>
                </div>
              : ''}
            </div>
          </Submittable>
        </div>
        <div className="create-password__footer">
          <button
            className="extension_cta_button create_cta"
            onClick={this.onSubmit}
            disabled={!this.isValidName()}
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  }
}
