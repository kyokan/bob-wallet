import React, { Component } from 'react';
import { clientStub as aClientStub } from '../../background/analytics/client.js';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import { connect } from 'react-redux';
import { getExchangeAuctions, finalizeExchangeBid } from '../../ducks/exchange.js';
import { displayBalance } from '../../utils/balances.js';
import moment from 'moment';
import PlaceBidModal from './PlaceBidModal.js';
import './exchange.scss';


const analytics = aClientStub(() => require('electron').ipcRenderer);

class Exchange extends Component {
  constructor(props) {
    super(props);
    this.state = {
      placingAuction: null,
    };
  }

  componentDidMount() {
    analytics.screenView('Exchange');
    this.props.getExchangeAuctions();
  }

  render() {
    if (this.props.isLoading) {
      return 'Loading...';
    }

    return (
      <div className="exchange">
        <h2>Your Bids</h2>
        <Table className="exchange-table">
          <HeaderRow>
            <HeaderItem>Name</HeaderItem>
            <HeaderItem>Status</HeaderItem>
            <HeaderItem>Amount</HeaderItem>
            <HeaderItem>Bid Placed At</HeaderItem>
            <HeaderItem />
          </HeaderRow>

          {this.props.fulfillments.length && this.props.fulfillments.map(f => (
            <TableRow>
              <TableItem>{f.fulfillment.name}</TableItem>
              <TableItem>{f.status}</TableItem>
              <TableItem>{displayBalance(f.fulfillment.price, true)}</TableItem>
              <TableItem>{moment(f.fulfillment.broadcastAt).format('MM/DD/YYYY HH:MM:SS')}</TableItem>
              <TableItem>
                {f.status === 'CONFIRMED_FINALIZABLE' && (
                  <div
                    className="bid-action__link"
                    onClick={() => this.props.finalizeExchangeBid(f.fulfillment)}
                  >
                    {this.props.finalizingName === f.name ? 'Finalizing...' : 'Finalize'}
                  </div>
                )}
              </TableItem>
            </TableRow>
          ))}
        </Table>

        <h2>Live Auctions</h2>
        <Table className="exchange-table">
          <Header />
          {this.props.auctions.length && this.props.auctions.map(this.renderAuctionRow)}

          {!this.props.auctions.length && (
            <div>
              No auctions found.
            </div>
          )}
          {this.props.isError && (
            <div>
              An error occurred. Please try again.
            </div>
          )}
        </Table>
        {this.state.placingAuction && (
          <PlaceBidModal
            auction={this.state.placingAuction}
            bid={this.state.placingCurrentBid}
            onClose={() => this.setState({
              placingAuction: null,
              placingCurrentBid: null,
            })}
          />
        )}
      </div>
    );
  }

  renderAuctionRow = (auction) => {
    const currentBid = this.getCurrentBid(auction);

    return (
      <TableRow>
        <TableItem>{auction.name}</TableItem>
        <TableItem>{displayBalance(currentBid.price, true)}</TableItem>
        <TableItem>{displayBalance(auction.bids[0].price, true)}</TableItem>
        <TableItem>{this.renderNextBid(auction)}</TableItem>
        <TableItem>
          <div
            className="bid-action__link"
            onClick={() => this.setState({
              placingAuction: auction,
              placingCurrentBid: currentBid,
            })}
          >
            Place Bid
          </div>
        </TableItem>
      </TableRow>
    );
  };

  getCurrentBid(auction) {
    const now = Date.now();
    let out;
    for (let i = 0; i < auction.bids.length; i++) {
      const bid = auction.bids[i];
      if (bid.lockTime > now) {
        break;
      }
      out = bid;
    }
    return out;
  }

  renderNextBid(auction) {
    const now = Date.now();
    let nextBid = null;
    for (let i = 0; i < auction.bids.length; i++) {
      const bid = auction.bids[i];
      if (bid.lockTime > now) {
        nextBid = bid;
        break;
      }
    }

    if (!nextBid) {
      return 'All Bids Released';
    }

    return moment(nextBid.lockTime).fromNow();
  }
}

function Header() {
  return (
    <HeaderRow>
      <HeaderItem>Name</HeaderItem>
      <HeaderItem>Current Bid</HeaderItem>
      <HeaderItem>Starting Bid</HeaderItem>
      <HeaderItem>Next Bid</HeaderItem>
      <HeaderItem />
    </HeaderRow>
  );
}

export default connect(
  (state) => ({
    auctions: state.exchange.auctionIds.map(id => state.exchange.auctions[id]),
    fulfillments: state.exchange.fulfillments,
    finalizingName: state.exchange.finalizingName,
  }),
  (dispatch) => ({
    getExchangeAuctions: (page) => dispatch(getExchangeAuctions(page)),
    finalizeExchangeBid: (fulfillment) => dispatch(finalizeExchangeBid(fulfillment)),
  }),
)(Exchange);
