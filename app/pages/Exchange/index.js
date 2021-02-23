import React, { Component } from 'react';
import { clientStub as aClientStub } from '../../background/analytics/client.js';
import { clientStub as sClientStub } from '../../background/shakedex/client.js';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import { connect } from 'react-redux';
import {
  getExchangeAuctions,
  finalizeExchangeBid,
  finalizeExchangeLock,
  launchExchangeAuction,
} from '../../ducks/exchange.js';
import { displayBalance } from '../../utils/balances.js';
import moment from 'moment';
import classNames from 'classnames';
import PlaceBidModal from './PlaceBidModal.js';
import './exchange.scss';
import PlaceListingModal from './PlaceListingModal.js';
import * as logger from '../../utils/logClient.js';
import {getExchangeFullfillments, getExchangeListings, LISTING_STATUS, submitToShakedex} from "../../ducks/exchange";
import {formatName} from "../../utils/nameHelpers";

const analytics = aClientStub(() => require('electron').ipcRenderer);
const shakedex = sClientStub(() => require('electron').ipcRenderer);

class Exchange extends Component {
  constructor(props) {
    super(props);
    this.state = {
      placingAuction: null,
      isPlacingListing: false,
    };
  }

  componentDidMount() {
    analytics.screenView('Exchange');
    this.props.getExchangeAuctions();
    this.props.getExchangeFullfillments();
    this.props.getExchangeListings();
  }

  onDownloadPresigns = async (proposals) => {
    try {
      const first = proposals[0];
      const submission = {
        name: first.name,
        lockingTxHash: first.lockingTxHash,
        lockingOutputIdx: first.lockingOutputIdx,
        publicKey: first.publicKey,
        paymentAddr: first.paymentAddr,
        data: proposals.map(p => ({
          price: p.price,
          lockTime: p.lockTime,
          signature: p.signature,
        })),
      };
      const content = JSON.stringify(submission);
      const data = `data:text/plain;charset=utf-8,${content}\r\n`;
      const encodedUri = encodeURI(data);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${submission.name}-presigns.json`);
      document.body.appendChild(link); // Required for FF
      link.click();
      link.remove();
    } catch (e) {
      logger.error(e.message);
      setTimeout(() => {
        throw e;
      }, 0);
    }
  };

  onClickDownload = async (auction) => {
    try {
      const content = (await shakedex.downloadProofs(auction)).data;
      const data = `data:text/plain;charset=utf-8,${content}\r\n`;
      const encodedUri = encodeURI(data);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${auction.name}.txt`);
      document.body.appendChild(link); // Required for FF
      link.click();
      link.remove();
    } catch (e) {
      logger.error(e.message);
      setTimeout(() => {
        throw e;
      }, 0);
    }
  };

  renderListingStatus(status) {
    let statusText = status;

    switch (status) {
      case LISTING_STATUS.NOT_FOUND:
        statusText = 'NOT FOUND';
        break;
      case LISTING_STATUS.SOLD:
        statusText = 'SOLD';
        break;
      case LISTING_STATUS.ACTIVE:
        statusText = 'ACTIVE';
        break;
      case LISTING_STATUS.TRANSFER_CONFIRMING:
        statusText = 'TRANSFERRING TO LISTING ADDRESS';
        break;
      case LISTING_STATUS.TRANSFER_CONFIRMED:
        statusText = 'READY TO FINALIZE LISTING';
        break;
      case LISTING_STATUS.FINALIZE_CONFIRMING:
        statusText = 'FINALIZING LISTING';
        break;
      case LISTING_STATUS.FINALIZE_CONFIRMED:
        statusText = 'READY TO START AUCTION';
        break;
    }

    return (
      <div className={classNames('exchange-table__listing-status', {
        'exchange-table__listing-status--active': status === LISTING_STATUS.ACTIVE,
        'exchange-table__listing-status--transfer-confirmed': status === LISTING_STATUS.TRANSFER_CONFIRMED,
        'exchange-table__listing-status--transfer-confirming': status === LISTING_STATUS.TRANSFER_CONFIRMING,
        'exchange-table__listing-status--sold': status === LISTING_STATUS.SOLD,
        'exchange-table__listing-status--not-found': status === LISTING_STATUS.NOT_FOUND,
        'exchange-table__listing-status--finalized-confirmed': status === LISTING_STATUS.FINALIZE_CONFIRMED,
        'exchange-table__listing-status--finalized-confirming': status === LISTING_STATUS.FINALIZE_CONFIRMING,
        'exchange-table__listing-status--transfer-cofirmed-lockup': status === LISTING_STATUS.TRANSFER_CONFIRMED_LOCKUP,
      })}>
        {statusText}
      </div>
    )
  }

  render() {
    if (this.props.isLoading) {
      return 'Loading...';
    }

    return (
      <div className="exchange">
        <div className="exchange__button-header">
          <h2>Your Listings</h2>
          <button
            className="exchange__button-header-button extension_cta_button"
            onClick={() => this.setState({
              isPlacingListing: true,
            })}
          >
            Create Listing
          </button>
        </div>
        <Table className="exchange-table">
          <HeaderRow>
            <HeaderItem>Name</HeaderItem>
            <HeaderItem>Status</HeaderItem>
            <HeaderItem>Start Bid</HeaderItem>
            <HeaderItem>End Bid</HeaderItem>
            <HeaderItem />
          </HeaderRow>
          {!this.props.listings.length && (
            <TableRow>
              <TableItem>
                No listings found.
              </TableItem>
            </TableRow>
          )}
          {!!this.props.listings.length && this.props.listings.map(l => (
            <TableRow key={l.nameLock.name}>
              <TableItem>{formatName(l.nameLock.name)}</TableItem>
              <TableItem>{this.renderListingStatus(l.status)}</TableItem>
              <TableItem>{displayBalance(l.params.startPrice)}</TableItem>
              <TableItem>{displayBalance(l.params.endPrice)}</TableItem>
              <TableItem>
                {l.status === LISTING_STATUS.TRANSFER_CONFIRMED && (
                  <div className="bid-action">
                    <div
                      className="bid-action__link"
                      onClick={() => this.props.finalizeExchangeLock(l.nameLock)}
                    >
                      {this.props.finalizingName === l.nameLock.name ? 'Finalizing...' : 'Finalize Listing'}
                    </div>
                  </div>
                )}
                {l.status === LISTING_STATUS.FINALIZE_CONFIRMED && (
                  <div className="bid-action">
                    <div
                      className="bid-action__link"
                      onClick={() => this.props.launchExchangeAuction(l.nameLock)}
                    >
                      Generate Presigns
                    </div>
                  </div>
                )}
                {l.status === LISTING_STATUS.ACTIVE && (
                  <div className="bid-action">
                    <div
                      className="bid-action__link"
                      onClick={() => this.onDownloadPresigns(l.proposals)}
                    >
                      Download
                    </div>
                    <div
                      className="bid-action__link"
                      onClick={() => this.props.submitToShakedex(l.proposals)}
                    >
                      Submit
                    </div>
                  </div>
                )}
              </TableItem>
            </TableRow>
          ))}
        </Table>

        <h2>Your Fills</h2>
        <Table className="exchange-table">
          <HeaderRow>
            <HeaderItem>Name</HeaderItem>
            <HeaderItem>Status</HeaderItem>
            <HeaderItem>Amount</HeaderItem>
            <HeaderItem>Fill Placed At</HeaderItem>
            <HeaderItem />
          </HeaderRow>

          {!!this.props.fulfillments.length && this.props.fulfillments.map(f => (
            <TableRow>
              <TableItem>{formatName(f.fulfillment.name)}</TableItem>
              <TableItem>{f.status}</TableItem>
              <TableItem>{displayBalance(f.fulfillment.price, true)}</TableItem>
              <TableItem>{moment(f.fulfillment.broadcastAt).format('MM/DD/YYYY HH:MM:SS')}</TableItem>
              <TableItem>
                {f.status === 'CONFIRMED_FINALIZABLE' && (
                  <div className="bid-action">
                    <div
                      className="bid-action__link"
                      onClick={() => this.props.finalizeExchangeBid(f.fulfillment)}
                    >
                      {this.props.finalizingName === f.name ? 'Finalizing...' : 'Finalize'}
                    </div>
                  </div>
                )}
              </TableItem>
            </TableRow>
          ))}
          {!this.props.fulfillments.length && (
            <TableRow>
              <TableItem>No fills found.</TableItem>
            </TableRow>
          )}
        </Table>

        <h2>Live Auctions</h2>
        <Table className="exchange-table">
          <Header />
          {!!this.props.auctions.length && this.props.auctions.map(this.renderAuctionRow)}

          {!this.props.auctions.length && (
            <TableRow>
              <TableItem>
                No auctions found.
              </TableItem>
            </TableRow>
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
        {this.state.isPlacingListing && (
          <PlaceListingModal
            onClose={() => this.setState({
              isPlacingListing: false,
            })}
          />
        )}
      </div>
    );
  }

  renderAuctionRow = (auction) => {
    const currentBid = this.getCurrentBid(auction);

    return (
      <TableRow key={auction.id}>
        <TableItem>{formatName(auction.name)}</TableItem>
        <TableItem>{displayBalance(currentBid.price, true)}</TableItem>
        <TableItem>{displayBalance(auction.bids[0].price, true)}</TableItem>
        <TableItem>{this.renderNextBid(auction)}</TableItem>
        <TableItem>
          <div className="exchange__auction-row-buttons">
            <div
              className="bid-action__link"
              onClick={() => this.setState({
                placingAuction: auction,
                placingCurrentBid: currentBid,
              })}
            >
              Fill
            </div>
            <div
              className="bid-action__link"
              onClick={() => this.onClickDownload(auction)}
            >
              Download Proofs
            </div>
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
    listings: state.exchange.listings,
    finalizingName: state.exchange.finalizingName,
  }),
  (dispatch) => ({
    getExchangeAuctions: (page) => dispatch(getExchangeAuctions(page)),
    getExchangeFullfillments: (page) => dispatch(getExchangeFullfillments(page)),
    getExchangeListings: (page) => dispatch(getExchangeListings(page)),
    finalizeExchangeBid: (fulfillment) => dispatch(finalizeExchangeBid(fulfillment)),
    finalizeExchangeLock: (nameLock) => dispatch(finalizeExchangeLock(nameLock)),
    launchExchangeAuction: (nameLock) => dispatch(launchExchangeAuction(nameLock)),
    submitToShakedex: (proposals) => dispatch(submitToShakedex(proposals)),
  }),
)(Exchange);
