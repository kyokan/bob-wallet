import React, { Component } from 'react';
import MiniModal from '../../components/Modal/MiniModal.js';
import { displayBalance } from '../../utils/balances.js';
import { connect } from 'react-redux';
import './exchange.scss';
import { placeExchangeBid } from '../../ducks/exchange.js';

export class PlaceBidModal extends Component {
  componentDidUpdate(prevProps) {
    if (prevProps.isPlacingBid && !this.props.isPlacingBid && !this.props.isPlacingBidError) {
      this.props.onClose();
    }
  }

  render() {
    const {auction, bid, onClose} = this.props;

    return (
      <MiniModal title="Place Bid" onClose={() => {
        if (this.props.isPlacingBid) {
          return;
        }
        onClose();
      }}>
        {this.props.isPlacingBidError && (
          <div className="place-bid-modal__alert">
            An error occurred while placing your bid. Please try again.
          </div>
        )}

        <p>
          Please confirm your bid below. Note that <strong>placing a bid is irreversible</strong>.
        </p>
        <table className="place-bid-modal__table">
          <tr>
            <td><strong>Name:</strong></td>
            <td>{auction.name}</td>
          </tr>
          <tr>
            <td><strong>Price:</strong></td>
            <td>{displayBalance(bid.price, true)}</td>
          </tr>
        </table>

        <div className="place-bid-modal__buttons">
          <button
            className="place-bid-modal__cancel"
            onClick={onClose}
            disabled={this.props.isPlacingBid}
          >
            Cancel
          </button>

          <button
            className="place-bid-modal__send"
            onClick={() => this.props.placeExchangeBid(auction, bid)}
            disabled={this.props.isPlacingBid}
          >
            {this.props.isPlacingBid ? 'Loading...' : 'Place Bid'}
          </button>
        </div>
      </MiniModal>
    );
  }
}

export default connect(
  (state) => ({
    isPlacingBid: state.exchange.isPlacingBid,
    isPlacingBidError: state.exchange.isPlacingBidError,
  }),
  (dispatch) => ({
    placeExchangeBid: (auction, bid) => dispatch(placeExchangeBid(auction, bid)),
  }),
)(PlaceBidModal);
