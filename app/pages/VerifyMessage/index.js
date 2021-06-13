import React, {Component} from "react";
import { connect } from 'react-redux';
import "./verify-message.scss";
import nodeClient from "../../utils/nodeClient";
import {showError, showSuccess} from "../../ducks/notifications";
import PropTypes from "prop-types";

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

  state = {
    name: '',
    rawMessage: '',
    signature: '',
    verified: null,
  };

  onVerify = async () => {
    const {rawMessage, signature, name} = this.state;
    const {showError, showSuccess} = this.props;
    try {
      const result = await nodeClient.verifyMessageWithName(name, signature, rawMessage);

      if (result) {
        showSuccess(`The message was signed by ${name}.`);
      } else {
        showError(`Invalid signature.`);
      }
    } catch (e) {
      showError(e.message);
    }
  };

  render() {
    return (
      <div className="verify-message">
        <div className="verify-message__top">
          <div className="verify-message__top-label">
            Enter Name to Verify:
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
            Verify Message
          </button>
        </div>
        <div className="verify-message__content">
          <div className="verify-message__content__textarea">
            <div className="verify-message__content__textarea__title">
              Message
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
              <span>Signature</span>
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
