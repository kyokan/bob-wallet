import { shell } from 'electron';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from "react-redux";
import PropTypes, { object } from 'prop-types';
import GenerateListingModal from '../../pages/Exchange/GenerateListingModal';
import Alert from '../Alert';
import MiniModal from '../Modal/MiniModal';
import { HeaderItem, HeaderRow, Table, TableItem, TableRow } from '../Table';
import { cancelExchangeLock, finalizeCancelExchangeLock, getExchangeListings } from "../../ducks/exchange";
import { LISTING_STATUS } from '../../constants/exchange';
import { formatName } from '../../utils/nameHelpers';
import { listingStatusToI18nKey } from '../../utils/shakedex';
import { I18nContext } from '../../utils/i18n';
import './shakedex-deprecated.scss';


@withRouter
@connect(
  (state) => ({
    listings: state.exchange.listings,
  }),
  (dispatch) => ({
    getExchangeListings: (page) => dispatch(getExchangeListings(page)),
    cancelExchangeLock: (nameLock) => dispatch(cancelExchangeLock(nameLock)),
    finalizeCancelExchangeLock: (nameLock) => dispatch(finalizeCancelExchangeLock(nameLock)),
  })
)
export default class ShakedexDeprecated extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }).isRequired,
    listings: PropTypes.arrayOf(object),
    getExchangeListings: PropTypes.func.isRequired,
    cancelExchangeLock: PropTypes.func.isRequired,
    finalizeCancelExchangeLock: PropTypes.func.isRequired,
    toggle: PropTypes.bool,
  };

  static contextType = I18nContext;

  state = {
    isOpen: false,
    isGeneratingListing: false,
    generatingListing: null,
  };

  async componentDidMount() {
    this.props.getExchangeListings();
  }

  async componentDidUpdate(prevProps, prevState) {
    if (this.props.toggle !== prevProps.toggle) {
      this.setState({ isOpen: !this.state.isOpen });
    }
  }

  cancelDeprecatedAuctions = async (listings) => {
    if (!listings.length)
      return;

    await this.props.cancelExchangeLock(listings.map(l => l.nameLock));
  }

  finalizeCancelDeprecatedAuctions = async (listings) => {
    if (!listings.length)
      return;

    await this.props.finalizeCancelExchangeLock(listings.map(l => l.nameLock));
  }

  render() {
    const { isOpen } = this.state;
    const { listings } = this.props;

    // deprecated -> list
    // !safe -> take action

    const deprecatedListings = listings.filter(l => l.deprecated);

    if (deprecatedListings.length === 0)
      return null;

    return (
      <>
        {/* Alert always visible */}
        {this.renderAlert()}

        {/* Modal only when open */}
        {isOpen && this.renderModal(deprecatedListings)}
      </>
    )
  }

  renderAlert() {
    return (
      <div onClick={() => this.setState({ isOpen: true })}>
        <Alert
          type="error"
          className="sd-blt-alert"
          message="Some of your active listings are at risk! Click for more info."
        />
      </div>
    );
  }

  renderModal(depListings) {
    const listingsToCancel = depListings.filter(l => !l.safe);
    const listingsToFinalizeCancel = depListings.filter(l => l.status === LISTING_STATUS.CANCEL_CONFIRMED);

    return (
      <MiniModal
        title="Shakedex Locktime Bug"
        className="sd-blt-modal"
        onClose={() => this.setState({ isOpen: false })}
        centered
        wide
      >
        <div className="section">
          A bug was discovered in shakedex that allows listed domains to be
          bought at a lesser price than what should be possible at that point in time.
          <span
            onClick={() => shell.openExternal('https://github.com/kyokan/bob-wallet/wiki/Shakedex-Locktime-Bug')}
          >
            More info
          </span>
        </div>
        <div className="section">
          <p>What can happen?</p>
          <p>
            If exploited, a name can be bought at the cheapest bid price
            without any time restrictions.
          </p>
        </div>
        <div className="section">
          <p>What is affected?</p>
          <p>
            The table below lists all your affected listings.
          </p>
          <p>
            <i>Safe: </i>Are safe either because their lowest bid's time has passed,
            or they have been cancelled.<br />
            <i>At Risk: </i>May be sold at a lower price (in parentheses) right now.
          </p>
        </div>
        <div className="section">
          <p>What can I do?</p>
          <p>
            For listings <i>At Risk</i>, the safest option is to cancel the listing
            to invalidate all auction bids. This will transfer the domains
            back to your wallet, and must be finalized after 2 days. They can be
            safely relisted later.
          </p>
          <p>
            Another option is to only generate new bids. Unlike cancelling,
            this will not take 2 days, but note that old bids are still valid,
            and anyone with the auction file can buy at the lowest price.
          </p>
        </div>

        <Table className="exchange-table section">
          <HeaderRow>
            <HeaderItem>Domain</HeaderItem>
            <HeaderItem>Status</HeaderItem>
            <HeaderItem>Status</HeaderItem>
            <HeaderItem />
          </HeaderRow>
          {depListings.map((l, i) => this.renderRow(l, i))}
        </Table>
        <div className="actions">
          <button
            onClick={() => this.cancelDeprecatedAuctions(listingsToCancel)}
            disabled={!listingsToCancel.length}
          >
            Cancel All Affected Auctions
          </button>
          <button
            onClick={() => this.finalizeCancelDeprecatedAuctions(listingsToFinalizeCancel)}
            disabled={!listingsToFinalizeCancel.length}
          >
            Finalize Cancel of Auctions
          </button>
        </div>
        {this.state.isGeneratingListing && (
          <GenerateListingModal
            listing={this.state.generatingListing}
            onClose={() => this.setState({
              isGeneratingListing: false,
              generatingListing: null,
            })}
          />
        )}
      </MiniModal>
    );
  }

  renderRow(listing, idx) {
    const { t } = this.context;

    const allBidsReleased = listing.safe && listing.status === LISTING_STATUS.ACTIVE;

    let riskiness = '';
    if (listing.safe) {
      if (allBidsReleased) {
        riskiness = 'Safe (all bids released)'
      } else {
        // Could be cancelling already, etc.
        riskiness = 'Safe'
      }
    } else {
      riskiness = `At Risk (${listing.lowestDeprecatedPrice/1e6>>>0} HNS)`
    }

    let statusText = listing.status;
    const i18nKey = listingStatusToI18nKey(listing.status);
    if (i18nKey)
      statusText = t(i18nKey);

    return (
      <TableRow key={idx}>
        <TableItem>{formatName(listing.nameLock.name)}</TableItem>
        <TableItem>{riskiness}</TableItem>
        <TableItem>{statusText}</TableItem>
        <TableItem>
          {!listing.safe &&
            <div className="exchange__auction-row-buttons">
              <div
                className="bid-action__link"
                onClick={() => this.setState({
                  isGeneratingListing: true,
                  generatingListing: listing,
                })}
              >
                Regenerate
              </div>
              <div
                className="bid-action__link"
                onClick={() => this.cancelDeprecatedAuctions([listing])}
              >
                Cancel
              </div>
            </div>
          }
          {listing.status === LISTING_STATUS.CANCEL_CONFIRMED &&
            <div className="exchange__auction-row-buttons">
              <div
                className="bid-action__link"
                onClick={() => this.finalizeCancelDeprecatedAuctions([listing])}
              >
                Finalize
              </div>
            </div>
          }
        </TableItem>
      </TableRow>
    )
  }
}
