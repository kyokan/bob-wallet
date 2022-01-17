import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import './zap-txs-modal.scss';
import Transaction from '../../components/Transactions/Transaction';
import Checkbox from '../../components/Checkbox';
import MiniModal from '../../components/Modal/MiniModal';
import { fetchTransactions } from '../../ducks/walletActions';
import walletClient from '../../utils/walletClient';
import {showError, showSuccess } from '../../ducks/notifications';
import {I18nContext} from "../../utils/i18n";

@connect(
  (state) => ({
    transactions: state.wallet.transactions,
  }),
  (dispatch) => ({
    fetchTransactions: () => dispatch(fetchTransactions()),
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
  })
)
class ZapTXsModal extends Component {
  static propTypes = {
    transactions: PropTypes.instanceOf(Map).isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  async componentDidMount() {
    await this.props.fetchTransactions()
  }

  state = {
    accepted: false,
  };

  zapTXs = async () => {
    this.props.history.push('/settings/wallet');
    try {
      await walletClient.zap();
      this.props.showSuccess(this.context.t('zapSuccess'));
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  render() {
    const txList = [];
    const {t} = this.context;
    let disabled = true;

    if (this.props.transactions) {
      const txs = [];

      this.props.transactions.forEach( tx => {
        if (tx.pending)
          txs.push(tx);
      });

      if (txs.length === 0) {
        txList.push(
          <div key="empty" className="transactions__empty-list">
            {t('zapNoPending')}
          </div>
        );
      }

      for (const tx of txs) {
        txList.push(
          <div className="transaction__container" key={tx.id}>
            <Transaction transaction={tx} />
          </div>
        );
        disabled = false;
      }
    } else {
      txList.push(
        <div key="empty" className="transactions__empty-list">
          {t('loading')}
        </div>
      );
    }

    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title={t('zapTitle')}
        wide
        centered
      >
        <div className="zap-txs-modal__tx-list">
          {txList}
        </div>
        <div className="zap-txs-modal__checkbox">
          <Checkbox
            className="zap-txs-modal__checkbox-box"
            onChange={() => {
              this.setState({
                accepted: !this.state.accepted
              })
            }}
            checked={this.state.accepted}
            disabled={disabled}
          />
          <div className="zap-txs-modal__checkbox-label">
            {t('zapAck')}
          </div>
        </div>
        <div className="">
          <button
            className="zap-txs-modal__action"
            onClick={this.zapTXs}
            disabled={!this.state.accepted}
          >
            {t('zapCTA')}
          </button>
        </div>
      </MiniModal>
    );
  }
}

export default ZapTXsModal;
