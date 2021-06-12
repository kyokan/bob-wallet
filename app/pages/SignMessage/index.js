import React, {Component} from "react";
import PropTypes from "prop-types";
import { connect } from 'react-redux';
import Dropdown from "../../components/Dropdown";
import {getMyNames} from "../../ducks/myDomains";
import SpinnerSVG from "../../assets/images/brick-loader.svg";
import "./sign-message.scss";
import walletClient from "../../utils/walletClient";
import {getPassphrase} from "../../ducks/walletActions";
import {showError} from "../../ducks/notifications";
import CopyButton from "../../components/CopyButton";

@connect(
  (state) => ({
    isFetchingNames: state.myDomains.isFetching,
    names: Object.keys(state.myDomains.names),
  }),
  (dispatch) => ({
    getMyNames: () => dispatch(getMyNames()),
    showError: (message) => dispatch(showError(message)),
    getPassphrase: (resolve, reject) => dispatch(getPassphrase(resolve, reject)),
  }),
)
class SignMessage extends Component {
  static propTypes = {
    isFetchingNames: PropTypes.bool.isRequired,
    names: PropTypes.array.isRequired,
    showError: PropTypes.func.isRequired,
    getMyNames: PropTypes.func.isRequired,
    getPassphrase: PropTypes.func.isRequired,
  };

  state = {
    nameIdx: 0,
    errorMessage: '',
    rawMessage: '',
    signature: '',
  };

  componentDidMount() {
    this.props.getMyNames();
  }

  onSign = async () => {
    const {names, getPassphrase, showError} = this.props;
    const {nameIdx, rawMessage} = this.state;
    const name = names[nameIdx];
    try {
      await new Promise((resolve, reject) => {
        getPassphrase(resolve, reject);
      });
      const result = await walletClient.signMessageWithName(name, rawMessage);
      this.setState({
        signature: result,
      });
    } catch (e) {
      showError(e.message);
      this.setState({
        signature: '',
      });
    }
  };

  render() {
    const {names, isFetchingNames} = this.props;

    return (
      <div className="sign-message">
        <div className="sign-message__top">
          <div className="sign-message__top-label">
            Select Name to Sign:
          </div>
          {
            isFetchingNames
              ? <div className="loader" style={{ backgroundImage: `url(${SpinnerSVG})`}} />
              : (
                <Dropdown
                  className="sign-message__top__name-dropdown"
                  items={names.map(n => ({
                    label: n,
                  }))}
                  onChange={(i) => this.setState({
                    nameIdx: i,
                    errorMessage: '',
                  })}
                  currentIndex={this.state.nameIdx}
                />
              )
          }
          <button
            className="sign-message__top__button"
            onClick={this.onSign}
            disabled={!this.state.rawMessage}
          >
            Sign Message
          </button>
        </div>
        <div className="sign-message__content">
          <div className="sign-message__content__textarea">
            <div className="sign-message__content__textarea__title">
              Message
            </div>
            <textarea
              className="sign-message__content__textarea__message"
              onChange={e => this.setState({
                rawMessage: e.target.value,
                signature: '',
              })}
              value={this.state.rawMessage}
            />
          </div>
          <div className="sign-message__content__textarea">
            <div className="sign-message__content__textarea__title">
              <span>Signature</span>
              <CopyButton content={this.state.signature} />
            </div>
            <textarea
              className="sign-message__content__textarea__signature"
              value={this.state.signature}
              disabled
            />
          </div>
        </div>
      </div>
    )
  }
}

export default SignMessage;
