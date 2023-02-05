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
import {I18nContext} from "../../utils/i18n";

@connect(
  (state) => ({
    isFetchingNames: state.myDomains.isFetching,
    names: Object.keys(state.myDomains.names).sort(),
    walletWatchOnly: state.wallet.watchOnly,
    walletN: state.wallet.n,
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
    walletWatchOnly: PropTypes.bool.isRequired,
    walletN: PropTypes.number,
    showError: PropTypes.func.isRequired,
    getMyNames: PropTypes.func.isRequired,
    getPassphrase: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

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
    const {names, isFetchingNames, walletWatchOnly, walletN} = this.props;
    const {t} = this.context;

    if (walletWatchOnly) {
      return t('notSupportWithLedger');
    }

    if (walletN > 1) {
      return t('notSupportWithMultisig');
    }

    return (
      <div className="sign-message">
        <div className="sign-message__top">
          <div className="sign-message__top-label">
            {t('signMessageTitle')}
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
            {t('signMessageCTA')}
          </button>
        </div>
        <div className="sign-message__content">
          <div className="sign-message__content__textarea">
            <div className="sign-message__content__textarea__title">
              {t('signMessageTextareaLabel')}
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
              <span>{t('signMessageSigLabel')}</span>
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
