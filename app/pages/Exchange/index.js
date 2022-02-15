import React, { Component } from 'react';
import fs from "fs";
import { connect } from 'react-redux';
import moment from 'moment';
import classNames from 'classnames';
const {dialog} = require('@electron/remote');
import { shell } from 'electron';
import { clientStub as aClientStub } from '../../background/analytics/client.js';
import { clientStub as sClientStub } from '../../background/shakedex/client.js';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../../components/Table';
import {
  getExchangeAuctions,
  finalizeExchangeBid,
  finalizeExchangeLock,
  launchExchangeAuction,
} from '../../ducks/exchange.js';
import { displayBalance } from '../../utils/balances.js';
import PlaceBidModal from './PlaceBidModal.js';
import PlaceListingModal from './PlaceListingModal.js';
import * as logger from '../../utils/logClient.js';
import {
  cancelExchangeLock, finalizeCancelExchangeLock,
  FULFILLMENT_STATUS,
  getExchangeFullfillments,
  getExchangeListings,
  LISTING_STATUS, setAuctionPage,
  submitToShakedex,
} from "../../ducks/exchange";
import {formatName} from "../../utils/nameHelpers";
import {showError} from "../../ducks/notifications";
import {fromAuctionJSON, validateAuction} from "../../utils/shakedex";
import nodeClient from '../../utils/nodeClient';
import './exchange.scss';
import PropTypes from "prop-types";
import {clearDeeplinkParams} from "../../ducks/app";
import {Link} from "react-router-dom";
import GenerateListingModal from "./GenerateListingModal";
import {getPageIndices} from "../../utils/pageable";
import Dropdown from "../../components/Dropdown";
import SpinnerSVG from '../../assets/images/brick-loader.svg';
import ConfirmFeeModal from './ConfirmFeeModal.js';
import {I18nContext} from "../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);
const shakedex = sClientStub(() => require('electron').ipcRenderer);

class Exchange extends Component {
  static propTypes = {
    deeplinkParams: PropTypes.object.isRequired,
    clearDeeplinkParams: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      placingAuction: null,
      placingCurrentBid: null,
      isPlacingListing: false,
      isUploadingFile: false,
      isGeneratingListing: false,
      isShowingFeeConfirmationFor: false,
      feeInfo: null,
      generatingListing: null,
      isLoading: true,
    };
  }

  componentDidMount() {
    analytics.screenView('Exchange');
    this.props.getExchangeFullfillments();
    this.props.getExchangeListings();
    this.fetchShakedex();
  }

  async fetchShakedex() {
    try {
      this.setState({ isLoading: true });
      await this.props.getExchangeAuctions();
      this.setState({ isLoading: false });
    } catch (e) {
      this.setState({ isLoading: false });
    }
  }

  static getDerivedStateFromProps(props, state) {
    try {
      const { presignJSONString } = props.deeplinkParams;
      let auction, currentBid;

      if (presignJSONString) {
        props.clearDeeplinkParams();
        auction = fromAuctionJSON(JSON.parse(presignJSONString));
        currentBid = getCurrentBid(auction);
        return {
          ...state,
          placingAuction: auction,
          placingCurrentBid: currentBid,
          isUploadingFile: false,
        };
      }

      return state;
    } catch (e) {
      props.clearDeeplinkParams();
      return state;
    }
  }

  onUploadPresigns = async () => {
    this.setState({
      isUploadingFile: true,
    });

    try {
      const {
        filePaths: [filepath]
      } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: {
          extensions: ['json'],
        },
      });

      const buf = await fs.promises.readFile(filepath);
      const content = buf.toString('utf-8');
      const auctionJSON = JSON.parse(content);

      await validateAuction(auctionJSON, nodeClient);

      const auction = fromAuctionJSON(auctionJSON);
      const currentBid = getCurrentBid(auction);

      this.setState({
        placingAuction: auction,
        placingCurrentBid: currentBid,
        isUploadingFile: false,
      });
    } catch (e) {
      this.props.showError(e.message);
      this.setState({
        placingAuction: null,
        placingCurrentBid: null,
        isUploadingFile: false,
      });
    }
  };

  onDownloadPresigns = async (listing) => {
    try {
      const submission = listing.auction;
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
      const submission = {
        lockingOutputIdx: auction.lockingOutputIdx,
        lockingTxHash: auction.lockingTxHash,
        name: auction.name,
        paymentAddr: auction.paymentAddr,
        publicKey: auction.publicKey,
        data: auction.bids.map(bid => ({
          price: bid.price,
          lockTime: bid.lockTime,
          signature: bid.signature,
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

  onClickSubmitShakedex = async (listing) => {
    const feeInfo = await shakedex.getFeeInfo();

    if (feeInfo.rate === 0) {
      return this.props.submitToShakedex(listing.auction);
    }

    this.setState({
      isShowingFeeConfirmationFor: listing,
      feeInfo,
    });
  };

  renderListingStatus(status) {
    let statusText = status;
    const {t} = this.context;

    switch (status) {
      case LISTING_STATUS.NOT_FOUND:
        statusText = t('shakedexStatusNotFound');
        break;
      case LISTING_STATUS.SOLD:
        statusText = t('shakedexStatusSold');
        break;
      case LISTING_STATUS.ACTIVE:
        statusText = t('shakedexStatusActive');
        break;
      case LISTING_STATUS.TRANSFER_CONFIRMING:
        statusText = t('shakedexStatusTransferConfirming');
        break;
      case LISTING_STATUS.TRANSFER_CONFIRMED:
        statusText = t('shakedexStatusTransferConfirmed');
        break;
      case LISTING_STATUS.FINALIZE_CONFIRMING:
        statusText = t('shakedexStatusFinalizeConfirming');
        break;
      case LISTING_STATUS.FINALIZE_CONFIRMED:
        statusText = t('shakedexStatusFinalizeConfirmed');
        break;
      case LISTING_STATUS.CANCEL_CONFIRMING:
        statusText = t('shakedexStatusCancelConfirming');
        break;
      case LISTING_STATUS.CANCEL_CONFIRMED:
        statusText = t('shakedexStatusCancelConfirmed');
        break;
      case LISTING_STATUS.FINALIZE_CANCEL_CONFIRMING:
        statusText = t('shakedexStatusFinalizeCancelConfirming');
        break;
      case LISTING_STATUS.FINALIZE_CANCEL_CONFIRMED:
        statusText = t('shakedexStatusFinalizeCancelConfirmed');
        break;
    }

    return (
      <div className={classNames('exchange-table__listing-status', {
        'exchange-table__listing-status--active': status === LISTING_STATUS.ACTIVE,
        'exchange-table__listing-status--transfer-confirmed': [
          LISTING_STATUS.TRANSFER_CONFIRMED,
          LISTING_STATUS.CANCEL_CONFIRMED,
        ].includes(status),
        'exchange-table__listing-status--transfer-confirming': [
          LISTING_STATUS.TRANSFER_CONFIRMING,
          LISTING_STATUS.CANCEL_CONFIRMING,
          LISTING_STATUS.FINALIZE_CANCEL_CONFIRMING,
        ].includes(status),
        'exchange-table__listing-status--sold': [
          LISTING_STATUS.SOLD,
          LISTING_STATUS.FINALIZE_CANCEL_CONFIRMED,
        ].includes(status),
        'exchange-table__listing-status--not-found': status === LISTING_STATUS.NOT_FOUND,
        'exchange-table__listing-status--finalized-confirmed': status === LISTING_STATUS.FINALIZE_CONFIRMED,
        'exchange-table__listing-status--finalized-confirming': status === LISTING_STATUS.FINALIZE_CONFIRMING,
        'exchange-table__listing-status--transfer-cofirmed-lockup': status === LISTING_STATUS.TRANSFER_CONFIRMED_LOCKUP,
      })}>
        {statusText}
      </div>
    )
  }

  renderFulfillmentStatus(status) {
    let statusText = status;
    const { t } = this.context;

    switch (status) {
      case FULFILLMENT_STATUS.NOT_FOUND:
        statusText = t('shakedexStatusNotFound');
        break;
      case FULFILLMENT_STATUS.CONFIRMING:
        statusText = t('shakedexStatusTransferringName');
        break;
      case FULFILLMENT_STATUS.CONFIRMED:
        statusText = t('shakedexStatusTransferredName');
        break;
      case FULFILLMENT_STATUS.CONFIRMED_LOCKUP:
        statusText = t('shakedexStatusConfirmedLockup');
        break;
      case FULFILLMENT_STATUS.FINALIZING:
        statusText = t('shakedexStatusFinalizingTransfer');
        break;
      case FULFILLMENT_STATUS.FINALIZED:
        statusText = t('shakedexStatusFulfilled');
        break;
    }

    return (
      <div className={classNames('exchange-table__listing-status', {
        'exchange-table__listing-status--active': status === FULFILLMENT_STATUS.FINALIZED,
        'exchange-table__listing-status--not-found': status === FULFILLMENT_STATUS.NOT_FOUND,
        'exchange-table__listing-status--transfer-confirmed': status === FULFILLMENT_STATUS.CONFIRMING,
        'exchange-table__listing-status--transfer-confirming': status === FULFILLMENT_STATUS.CONFIRMED,
        'exchange-table__listing-status--finalized-confirmed': status === FULFILLMENT_STATUS.CONFIRMED_LOCKUP,
        'exchange-table__listing-status--finalized-confirming': status === FULFILLMENT_STATUS.FINALIZING,
      })}>
        {statusText}
      </div>
    )
  }

  render() {
    const { t } = this.context;
    if (this.props.walletWatchOnly) {
      return t('notSupportWithLedger');
    }

    if (this.props.isLoading) {
      return t('loading');
    }

    return (
      <div className="exchange">
        <div className="exchange__button-header">
          <h2>{t('yourListings')}</h2>
          <button
            className="exchange__button-header-button extension_cta_button"
            onClick={() => this.setState({
              isPlacingListing: true,
            })}
          >
            {t('createListing')}
          </button>
        </div>
        <div className="exchange__button-header__sub">
          {t('sdBackupReminder', '')}
          <Link to="/settings/exchange/backup">Settings/Exchange</Link>
        </div>
        <Table className="exchange-table">
          <HeaderRow>
            <HeaderItem>{t('domain')}</HeaderItem>
            <HeaderItem>{t('status')}</HeaderItem>
            <HeaderItem>{t('startingPrice')}</HeaderItem>
            <HeaderItem>{t('endingPrice')}</HeaderItem>
            <HeaderItem />
          </HeaderRow>
          {!this.props.listings.length && (
            <TableRow>
              <TableItem>
                {t('noListingFound')}
              </TableItem>
            </TableRow>
          )}
          {!!this.props.listings.length && this.props.listings.map(l => this.renderListingRow(l))}
        </Table>

        <div className="exchange__button-header">
          <h2>{t('yourFills')}</h2>
          <button
            className="exchange__button-header-button extension_cta_button"
            onClick={this.onUploadPresigns}
          >
            {t('uploadAuctionFile')}
          </button>
        </div>
        <Table className="exchange-table">
          <HeaderRow>
            <HeaderItem>{t('domain')}</HeaderItem>
            <HeaderItem>{t('status')}</HeaderItem>
            <HeaderItem>{t('amount')}</HeaderItem>
            <HeaderItem>{t('fillPlacedAt')}</HeaderItem>
            <HeaderItem />
          </HeaderRow>

          {!!this.props.fulfillments.length && this.props.fulfillments.map(f => (
            <TableRow>
              <TableItem>{formatName(f.fulfillment.name)}</TableItem>
              <TableItem>{this.renderFulfillmentStatus(f.status)}</TableItem>
              <TableItem>{displayBalance(f.fulfillment.price, true)}</TableItem>
              <TableItem>{moment(f.fulfillment.broadcastAt).format('MM/DD/YYYY HH:MM:SS')}</TableItem>
              <TableItem>
                {[FULFILLMENT_STATUS.CONFIRMED].includes(f.status)  && (
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
              <TableItem>{t('noFillsFound')}</TableItem>
            </TableRow>
          )}
        </Table>

        <h2>{t('liveAuctions')}</h2>
        <Table className="exchange-table">
          <Header />
          {this.state.isLoading && (
            <TableRow>
              <div className="loader" style={{ backgroundImage: `url(${SpinnerSVG})`}} />
            </TableRow>
          )}
          {!this.state.isLoading && !!this.props.auctions.length && this.props.auctions.map(this.renderAuctionRow)}
          {this.renderListingControls()}
          {!this.state.isLoading && !this.props.auctions.length && (
            <TableRow>
              <TableItem>
                {t('noAuctionsFound')}
              </TableItem>
            </TableRow>
          )}
          {this.props.isError && (
            <div>
              {t('genericError')}
            </div>
          )}
        </Table>
        {this.state.placingAuction && this.state.placingCurrentBid && (
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
        {this.state.isGeneratingListing && (
          <GenerateListingModal
            listing={this.state.generatingListing}
            onClose={() => this.setState({
              isGeneratingListing: false,
              generatingListing: null,
            })}
          />
        )}
        {this.state.isShowingFeeConfirmationFor && (
          <ConfirmFeeModal
            listing={this.state.isShowingFeeConfirmationFor}
            feeInfo={this.state.feeInfo}
            onClose={() => this.setState({
              isShowingFeeConfirmationFor: null,
              feeInfo: null,
            })}
          />
        )}
      </div>
    );
  }

  renderListingControls = () => {
    const {
      auctions,
      total,
      currentPage: currentPageIndex,
    } = this.props;

    const {t} = this.context;

    if (!auctions.length) {
      return null;
    }

    const totalPages = Math.ceil(total / 20);
    const pageIndices = getPageIndices(Array(total).fill(0), 20, currentPageIndex - 1);

    return (
      <div className="domain-manager__page-control">
        <div className="domain-manager__page-control__numbers">
          <div
            className="domain-manager__page-control__start"
            onClick={async () => {
              this.props.setAuctionPage(Math.max(currentPageIndex - 1, 1));
              this.fetchShakedex();
            }}
          />
          {pageIndices.map((pageIndex, i) => {
            if (pageIndex === '...') {
              return (
                <div key={`${pageIndex}-${i}`} className="domain-manager__page-control__ellipsis">...</div>
              );
            }

            return (
              <div
                key={`${pageIndex}-${i}`}
                className={classNames('domain-manager__page-control__page', {
                  'domain-manager__page-control__page--active': currentPageIndex === pageIndex + 1,
                })}
                onClick={async () => {
                  this.props.setAuctionPage(pageIndex + 1);
                  this.fetchShakedex();
                }}
              >
                {pageIndex + 1}
              </div>
            )
          })}
          <div
            className="domain-manager__page-control__end"
            onClick={async () => {
              this.props.setAuctionPage(Math.min(currentPageIndex + 1, totalPages));
              this.fetchShakedex();
            }}
          />
        </div>
        <div className="domain-manager__go-to">
          <div className="domain-manager__go-to__text">{t('page')}</div>
          <Dropdown
            className="domain-manager__go-to__dropdown"
            items={Array(totalPages).fill(0).map((_, i) => ({ label: `${i + 1}` }))}
            onChange={async currentPageIndex => {
              this.props.setAuctionPage(currentPageIndex + 1);
              this.fetchShakedex();
            }}
            currentIndex={currentPageIndex - 1}
          />
          <div className="domain-manager__go-to__total">of {totalPages}</div>
        </div>
      </div>
    )
  }

  renderListingRow = (l) => {
    const { auction } = l;
    const { data = [] } = auction || {};
    const lastBid = data[data.length - 1];
    const { lockTime = 0 } = lastBid || {}
    const now = Date.now();
    const hasLastBidReleased = now > lockTime * 1000;
    const {t} = this.context;

    return (
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
                {this.props.finalizingName === l.nameLock.name ? `${t('finalizing')}...` : t('finalize')}
              </div>
            </div>
          )}
          {l.status === LISTING_STATUS.FINALIZE_CONFIRMED && (
            <div className="bid-action">
              <div
                className="bid-action__link"
                onClick={() => this.setState({
                  isGeneratingListing: true,
                  generatingListing: l,
                })}
              >
                {t('generate')}
              </div>
            </div>
          )}
          {l.status === LISTING_STATUS.CANCEL_CONFIRMED && (
            <div className="bid-action">
              <div
                className="bid-action__link"
                onClick={() => this.props.finalizeCancelExchangeLock(l.nameLock)}
              >
                {t('finalizeCancel')}
              </div>
            </div>
          )}
          {l.status === LISTING_STATUS.ACTIVE && (
            <div className="bid-action">
              {
                (!auction && hasLastBidReleased) && (
                  <div
                    className="bid-action__link"
                    onClick={() => this.setState({
                      isGeneratingListing: true,
                      generatingListing: l,
                    })}
                  >
                    {t('regenerate')}
                  </div>
                )
              }
              <div
                className="bid-action__link"
                onClick={() => this.onDownloadPresigns(l)}
              >
                {t('download')}
              </div>
              <div
                className="bid-action__link"
                onClick={() => this.onClickSubmitShakedex(l)}
              >
                {t('submit')}
              </div>

              <div
                className="bid-action__link"
                onClick={() => this.props.cancelExchangeLock(l.nameLock)}
              >
                {t('cancel')}
              </div>
            </div>
          )}
        </TableItem>
      </TableRow>
    );
  };

  renderAuctionRow = (auction) => {
    const {t} = this.context;
    const currentBid = getCurrentBid(auction);

    return (
      <TableRow
        key={auction.id}
        className="exchange__auction-listing__row"
        onClick={() => shell.openExternal(`https://shakedex.com/a/${auction.name}`)}
      >
        <TableItem>{formatName(auction.name)}</TableItem>
        <TableItem>{displayBalance(currentBid?.price, true)}</TableItem>
        <TableItem>{this.renderNextBid(auction)}</TableItem>
        <TableItem>
          {
            !auction.spendingStatus && (
              <div className="exchange__auction-row-buttons">
                <div
                  className="bid-action__link"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.setState({
                      placingAuction: auction,
                      placingCurrentBid: currentBid,
                    });
                  }}
                >
                  {t('fill')}
                </div>
                <div
                  className="bid-action__link"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.onClickDownload(auction);
                  }}
                >
                  {t('downloadProofs')}
                </div>
              </div>
            )
          }
        </TableItem>
      </TableRow>
    );
  };

  renderNextBid(auction) {
    const {t} = this.context;

    if (auction.spendingStatus) {
      switch (auction.spendingStatus) {
        case "COMPLETED":
          return t('sold');
        case "CANCELLED":
          return t('cancelled');
      }
    }

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
      return t('allBidsReleased');
    }

    return moment(nextBid.lockTime).fromNow();
  }
}

class Header extends Component {
  static contextType = I18nContext;

  render() {
    const {t} = this.context;
    return (
      <HeaderRow>
        <HeaderItem>{t('domain')}</HeaderItem>
        <HeaderItem>{t('currentBid')}</HeaderItem>
        <HeaderItem>{t('nextBid')}</HeaderItem>
        <HeaderItem />
      </HeaderRow>
    );
  }
}

export default connect(
  (state) => ({
    auctions: state.exchange.auctionIds.map(id => state.exchange.auctions[id]),
    total: state.exchange.total,
    currentPage: state.exchange.currentPage,
    fulfillments: state.exchange.fulfillments,
    listings: state.exchange.listings,
    finalizingName: state.exchange.finalizingName,
    deeplinkParams: state.app.deeplinkParams,
    walletWatchOnly: state.wallet.watchOnly,
  }),
  (dispatch) => ({
    setAuctionPage: (page) => dispatch(setAuctionPage(page)),
    getExchangeAuctions: () => dispatch(getExchangeAuctions()),
    getExchangeFullfillments: (page) => dispatch(getExchangeFullfillments(page)),
    getExchangeListings: (page) => dispatch(getExchangeListings(page)),
    finalizeExchangeBid: (fulfillment) => dispatch(finalizeExchangeBid(fulfillment)),
    finalizeExchangeLock: (nameLock) => dispatch(finalizeExchangeLock(nameLock)),
    cancelExchangeLock: (nameLock) => dispatch(cancelExchangeLock(nameLock)),
    finalizeCancelExchangeLock: (nameLock) => dispatch(finalizeCancelExchangeLock(nameLock)),
    launchExchangeAuction: (nameLock) => dispatch(launchExchangeAuction(nameLock)),
    submitToShakedex: (auction) => dispatch(submitToShakedex(auction)),
    showError: (errorMessage) => dispatch(showError(errorMessage)),
    clearDeeplinkParams: () => dispatch(clearDeeplinkParams()),
  }),
)(Exchange);

function getCurrentBid(auction) {
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
