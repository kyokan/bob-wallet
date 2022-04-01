import React, {Component} from "react";
import { connect } from 'react-redux';
import "./multisig.scss";
import nodeClient from "../../utils/nodeClient";
import {showError, showSuccess} from "../../ducks/notifications";
import PropTypes from "prop-types";
import {I18nContext} from "../../utils/i18n";
import walletClient from "../../utils/walletClient";
import HDPublicKey from "hsd/lib/hd/public";
import { getPassphrase, signMessage } from "../../ducks/walletActions";
import { MTX } from "hsd/lib/primitives";

@connect(
  (state) => ({
  }),
  (dispatch) => ({
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    signMessage: (message) => dispatch(signMessage(message)),
  }),
)
class Multisig extends Component {
  static propTypes = {
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  state = {
    xpubKey: '',
    accountInfo: null,
    addKey: '',
    rawMessage: '',
    signature: '',
    verified: null,
  };

  async componentDidMount() {
    await this.reloadAccount();
  }

  broadcast = async () => {
    var tx = null;

    try {
      tx = MTX.decode(Buffer.from(this.state.signature, 'hex'));
    }
    catch(e) {
      alert('Invalid TX');
      return;
    }

    try {
      const txObj = tx.toJSON();
      await nodeClient.broadcastRawTx(txObj.hex);
      alert('Broadcast success. If the transaction is valid it will be sent soon. hash=' + txObj.hash);
    }
    catch(e) {
      alert('Failed to broadcast: ' + e?.message);
    }
  };

  addSignature = async () => {
    const {signMessage} = this.props;
    var tx = null;

    try {
      tx = MTX.decode(Buffer.from(this.state.rawMessage, 'hex'));
    }
    catch(e) {
      alert('Invalid TX');
      return;
    }
    const resp = await signMessage(tx);
    this.setState({signature: resp.hex});
  }

  reloadAccount = async () => {
      const accountInfo = await walletClient.getAccountInfo();
      this.setState({accountInfo: accountInfo, xpubKey: accountInfo.accountKey});
  };

  onAddXpub = async() => {
    const account = await walletClient.addSharedKey(this.state.addKey);
    await this.reloadAccount();
    this.setState({addKey: ''});
    walletClient.rescan(0);
  }

  render() {
    const {t} = this.context;

    if(this.state.accountInfo == null) {
      return (
        <div>Loading...</div>
      );
    }

    return (
      <div className="multisig">
        <div>
          <strong>Status: </strong> 
          {this.state.accountInfo.initialized ? <span>Initialized</span> : 
            <span>Not Initialized, need {this.state.accountInfo.n - this.state.accountInfo.keys.length - 1} more key(s).</span>}
        </div>
        <div>
          <strong>Signers needed for a signature: </strong> {this.state.accountInfo.m}
        </div>
        <div>
          <strong>Total possible signers: </strong> {this.state.accountInfo.n}
        </div>
        <div style={{marginTop: 10}}>
          <strong>My Multisig Public Key: </strong> 
          <span style={{width: '60%', overflowWrap: 'break-word'}}>{this.state.xpubKey}</span>
        </div>
        <div style={{marginTop: 10}}>
          <strong>Multisig Receive Address: </strong> 
          <span style={{width: '60%', overflowWrap: 'break-word'}}>{this.state.accountInfo.initialized ? 
            this.state.accountInfo.receiveAddress : 'Not Available'}</span>
        </div>
        <div style={{marginTop: 10}} className="multisig__top">
          <input
            type="text"
            className="multisig__top__name-input"
            style={{width: '75%'}}
            value={this.state.addKey}
            onChange={e => this.setState({ addKey: e.target.value })}
          />
          <button
            className="multisig__top__button"
            style={{marginLeft: '5px'}}
            onClick={this.onAddXpub}
          >
            {t('multisigAddKey')}
          </button>
        </div>
        <div className="multisig__content">
          <div className="multisig__content__textarea">
            <div className="multisig__content__textarea__title">
              {t('signMessageTextareaLabel')}
            </div>
            <textarea
              className="multisig__content__textarea__message"
              onChange={e => this.setState({
                rawMessage: e.target.value,
              })}
              value={this.state.rawMessage}
            />
          </div>
          <div className="multisig__content__textarea">
            <div className="multisig__content__textarea__title">
              <span>{t('signMultisigMessageSigLabel')}</span>
            </div>
            <textarea
              className="multisig__content__textarea__signature"
              onChange={e => this.setState({
                signature: e.target.value,
              })}
              value={this.state.signature}
            />
          </div>
        </div>
        <div style={{marginTop: '10px', display: 'flex', width: '100%', justifyContent: 'flex-start', gap: '10px'}}>
          <button
            className="multisig__top__button"
            onClick={this.addSignature}
          >
            Add signature to message
          </button>
          <button
            className="multisig__top__button"
            onClick={this.broadcast}
          >
            Broadcast Message
          </button>
        </div>
      </div>
    )
  }
}

export default Multisig;
