import React, { Component } from 'react';
import { connect } from 'react-redux';
import { MiniModal } from '../../components/Modal/MiniModal.js';
import { submitToShakedex } from '../../ducks/exchange.js';
import { clientStub as sClientStub } from '../../background/shakedex/client.js';
import { getPassphrase } from '../../ducks/walletActions.js';
import Hash from "../../components/Hash";
import {shell} from "electron";
import {I18nContext} from "../../utils/i18n";

const shakedex = sClientStub(() => require('electron').ipcRenderer);

export class ConfirmFeeModal extends Component {
  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      isListing: false,
    };
  }

  uploadListing = async () => {
    this.setState({
      isListing: true,
    });
    const {listing, feeInfo} = this.props;
    const overrideParams = {
      ...listing.params,
      feeRate: feeInfo.rate,
      feeAddr: feeInfo.addr,
    };
    const passphrase = await new Promise((resolve, reject) => this.props.getPassphrase(resolve, reject));
    const regeneratedAuction = await shakedex.launchAuction(listing.nameLock, passphrase, overrideParams, false);
    this.props.onClose();
    await this.props.submitToShakedex(regeneratedAuction);

  };

  render() {
    const {onClose, feeInfo, explorer} = this.props;
    const {t} = this.context;

    const address = (
      <b onClick={() => shell.openExternal(explorer.address.replace('%s', feeInfo.address))}>
        <Hash value={feeInfo.address}/>
      </b>
    );

    return (
      <MiniModal title={t('confirmFee')} onClose={onClose}>
        <p>
          {`${t('shakedexFee1', `${feeInfo.rate / 100}%`)} ${t('shakedexFee2', address)}`}
        </p>

        <p>
          <strong>${t('note')}:</strong>
          {t('shakedexNote')}
        </p>

        <div className="place-bid-modal__buttons">
          <button
            className="place-bid-modal__cancel"
            onClick={onClose}
            disabled={this.props.isListing}
          >
            {t('cancel')}
          </button>

          <button
            className="place-bid-modal__send"
            onClick={this.uploadListing}
            disabled={this.props.isListing}
          >
            {this.props.isListing ? t('loading') : t('submit')}
          </button>
        </div>
      </MiniModal>
    );
  }
}

export default connect(
  state => ({
    explorer: state.node.explorer,
  }),
  (dispatch) => ({
    getPassphrase: (resolve, reject) => dispatch(getPassphrase(resolve, reject)),
    submitToShakedex: (auction) => dispatch(submitToShakedex(auction)),
  }),
)(
  ConfirmFeeModal,
);
