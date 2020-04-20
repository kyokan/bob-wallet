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

  async componentDidMount() {
    await this.props.fetchTransactions()
  }

  state = {
    accepted: false,
  };

  zapTXs = async () => {
    this.props.history.push('/settings');
    try {
      await walletClient.zap();
      this.props.showSuccess('All pending transactions have been deleted!');
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  render() {
    const txList = [];
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
            You do not have any pending transactions.
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
          Loading pending transactions...
        </div>
      );
    }

    return (
      <MiniModal
        closeRoute="/settings"
        title="Delete unconfirmed transactions"
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
            I understand this will remove unconfirmed transactions from my wallet
            but may not completely remove them from the network. They may still be
            relayed between nodes and confirmed in blocks. By deleting pending
            transactions this wallet may re-spend "stuck" coins, but those
            new transactions are not garunteed to replace the originals.
          </div>
        </div>
        <div className="">
          <button
            className="zap-txs-modal__action"
            onClick={this.zapTXs}
            disabled={!this.state.accepted}
          >
            Delete Unconfirmed Transactions
          </button>
        </div>
      </MiniModal>
    );
  }
}

export default ZapTXsModal;
