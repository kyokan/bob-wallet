import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import {
  AuctionPanel,
  AuctionPanelFooter,
  AuctionPanelHeader,
  AuctionPanelHeaderRow,
} from '../../../components/AuctionPanel';
import Blocktime from '../../../components/Blocktime';
import * as nameActions from '../../../ducks/names';
import { showError, showSuccess } from '../../../ducks/notifications';
import { isOpening } from '../../../utils/nameHelpers';
import * as logger from '../../../utils/logClient';
import { clientStub as aClientStub } from '../../../background/analytics/client';
import {I18nContext} from "../../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

class OpenBid extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    isPending: PropTypes.bool.isRequired,
    sendOpen: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    currentBlock: PropTypes.number.isRequired,
  };

  static contextType = I18nContext;

  sendOpen = async () => {
    const {sendOpen} = this.props;
    const {t} = this.context;

    try {
      const res = await sendOpen();
      if (res !== null) {
        this.props.showSuccess(t('openSuccessText'));
        analytics.track('opened bid');
      }
    } catch (e) {
      console.error(e);
      logger.error(`Error received from OpenBid - sendOpen]\n\n${e.message}\n${e.stack}\n`);
      this.props.showError(t('openFailureText', e.message));
    }
  };

  render() {
    const {currentBlock, domain} = this.props;
    const {start} = domain || {};
    const startBlock = start.start;
    const {t} = this.context;

    return (
      <AuctionPanel>
        <AuctionPanelHeader title={t('auctionDetailTitle')}>
          <AuctionPanelHeaderRow label={t('available') + ':'}>
            <div
              className={c('domains__bid-now__info__value', {
                'domains__bid-now__info__value--green': startBlock <= currentBlock,
              })}
            >
              {
                startBlock <= currentBlock
                  ? t('now')
                  : (
                    <div>
                      <Blocktime height={startBlock} format="ll" />
                    </div>
                  )
              }
            </div>
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label={t('blockNumber') + ':'}>{startBlock}</AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label={t('currentBlock') + ':'}>{currentBlock}</AuctionPanelHeaderRow>
        </AuctionPanelHeader>
        <AuctionPanelFooter>
          {this.renderBottom()}
        </AuctionPanelFooter>
      </AuctionPanel>
    );
  }

  renderBottom() {
    const {domain, currentBlock, isPending} = this.props;
    const {t} = this.context;
    const {start, info} = domain || {};
    const {openPeriodEnd} = info?.stats || {}
    const startBlock = start.start;

    if (isOpening(domain)) {
      return (
        <div className="domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__content domains__bid-now__opening-text">
            {isPending ?
              t('openingText')
              :
              <>
                {t('openingTextWaitForBidding')}
                <Blocktime height={openPeriodEnd} format="ll" fromNow={true} />
              </>
            }
          </div>
          <div className="domains__bid-now__action">
            <button
              className="domains__bid-now__action__cta"
              disabled
            >
              {isPending ? t('startingAuction') : t('openingNow')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="domains__bid-now__action--placing-bid">
        <div className="domains__bid-now__content domains__open-bid__content">
          {
            startBlock <= currentBlock
              ? t('openBidText')
              : (
                <span>
                  Come back around
                  {' '}
                  <Blocktime height={startBlock} format="ll" />
                  {' '}
                  to open the auction. You can add the domain to your watchlist to make sure you don't miss it.
              </span>
              )

          }
        </div>
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={this.sendOpen}
            disabled={!(startBlock <= currentBlock)}
          >
            {t('startAuction')}
          </button>
        </div>
      </div>
    );
  }
}

export default connect(
  (state, {domain}) => ({
    currentBlock: state.node.chain.height,
    network: state.wallet.network,
    isPending: domain.pendingOperation === 'OPEN',
  }),
  (dispatch, {name}) => ({
    sendOpen: () => dispatch(nameActions.sendOpen(name)),
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)(OpenBid);
