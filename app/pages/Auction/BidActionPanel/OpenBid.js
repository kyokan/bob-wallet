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

const analytics = aClientStub(() => require('electron').ipcRenderer);

class OpenBid extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    sendOpen: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    currentBlock: PropTypes.number.isRequired,
  };

  sendOpen = async () => {
    const {sendOpen} = this.props;

    try {
      await sendOpen();
      this.props.showSuccess('Successfully opened auction! Check back in a few minutes to start bidding.');
      analytics.track('opened bid');
    } catch (e) {
      console.error(e);
      logger.error(`Error received from OpenBid - sendOpen]\n\n${e.message}\n${e.stack}\n`);
      this.props.showError(`Failed to open auction: ${e.message}`);
    }
  };

  render() {
    const {currentBlock, domain} = this.props;
    const {start} = domain || {};
    const startBlock = start.start;

    return (
      <AuctionPanel>
        <AuctionPanelHeader title="Auction Details">
          <AuctionPanelHeaderRow label="Available:">
            <div
              className={c('domains__bid-now__info__value', {
                'domains__bid-now__info__value--green': startBlock <= currentBlock,
              })}
            >
              {
                startBlock <= currentBlock
                  ? 'Now'
                  : (
                    <div>
                      <Blocktime height={startBlock} format="ll" />
                    </div>
                  )
              }
            </div>
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Block Number:">{startBlock}</AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Current Block:">{currentBlock}</AuctionPanelHeaderRow>
        </AuctionPanelHeader>
        <AuctionPanelFooter>
          {this.renderBottom()}
        </AuctionPanelFooter>
      </AuctionPanel>
    );
  }

  renderBottom() {
    const {domain, currentBlock} = this.props;
    const {start} = domain || {};
    const startBlock = start.start;
    console.log('my new start block is', startBlock);

    if (isOpening(domain)) {
      return (
        <div className="domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__content domains__bid-now__opening-text">
            Your open auction request is pending and will be mined within the next block.
          </div>
          <div className="domains__bid-now__action">
            <button
              className="domains__bid-now__action__cta"
              disabled
            >
              Starting Auction...
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
              ?
              'Start the auction process by making an open bid.'
              :
              <span>
                Come back around{' '}
                <Blocktime height={startBlock} format="ll" /> to open the auction. You can add the domain
                to your watchlist to make sure you don't miss it.
              </span>
          }
        </div>
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={this.sendOpen}
            disabled={!(startBlock <= currentBlock)}
          >
            Start Auction
          </button>
        </div>
      </div>
    );
  }
}

export default connect(
  (state) => ({
    currentBlock: state.node.chain.height,
    network: state.node.network,
  }),
  (dispatch, {name}) => ({
    sendOpen: () => dispatch(nameActions.sendOpen(name)),
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)(OpenBid);
