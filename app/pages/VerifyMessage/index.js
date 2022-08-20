import React, {Component} from "react";
import { connect } from 'react-redux';
import "./verify-message.scss";
import nodeClient from "../../utils/nodeClient";
import {showError, showSuccess} from "../../ducks/notifications";
import PropTypes from "prop-types";
import {I18nContext} from "../../utils/i18n";

@connect(
  (state) => ({
  }),
  (dispatch) => ({
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)
class VerifyMessage extends Component {
  static propTypes = {
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  state = {
    name: '',
    rawMessage: '',
    signature: '',
    verified: null,
  };

  onVerify = async () => {
    const {rawMessage, signature, name} = this.state;
    const {showError, showSuccess} = this.props;
    const {t} = this.context;

    try {
      const result = await nodeClient.verifyMessageWithName(name, signature, rawMessage);

      if (result) {
        showSuccess(t('verifySuccess', name));
      } else {
        showError(t('verifyFailure'));
      }
    } catch (e) {
      showError(e.message);
    }
  };

  render() {
    const {t} = this.context;

    return (
      <div className="verify-message">
        <div className="verify-message__top">
          <div className="verify-message__top-label">
            {t('verifyNameSelectLabel')}
          </div>
          <input
            type="text"
            className="verify-message__top__name-input"
            value={this.state.name}
            onChange={e => this.setState({ name: e.target.value })}
          />
          <button
            className="verify-message__top__button"
            onClick={this.onVerify}
            disabled={!this.state.rawMessage || !this.state.name || !this.state.signature}
          >
            {t('verifyCTA')}
          </button>
        </div>
        <div className="verify-message__content">
          <div className="verify-message__content__textarea">
            <div className="verify-message__content__textarea__title">
              {t('signMessageTextareaLabel')}
            </div>
            <textarea
              className="verify-message__content__textarea__message"
              onChange={e => this.setState({
                rawMessage: e.target.value,
              })}
              value={this.state.rawMessage}
            />
          </div>
          <div className="verify-message__content__textarea">
            <div className="verify-message__content__textarea__title">
              <span>{t('signMessageSigLabel')}</span>
            </div>
            <textarea
              className="verify-message__content__textarea__signature"
              onChange={e => this.setState({
                signature: e.target.value,
              })}
              value={this.state.signature}
            />
          </div>
        </div>
      </div>
    )
  }
}

export default VerifyMessage;
