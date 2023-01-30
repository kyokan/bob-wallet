import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import {
  AuctionPanel,
  AuctionPanelFooter,
  AuctionPanelHeader,
  AuctionPanelHeaderRow
} from '../../../components/AuctionPanel';
import { displayBalance } from '../../../utils/balances';
import Blocktime from '../../../components/Blocktime';
import * as names from '../../../ducks/names';
import { showError, showSuccess } from '../../../ducks/notifications';
import {I18nContext} from "../../../utils/i18n";

class Sold extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    chain: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired,
    sendRedeem: PropTypes.func.isRequired,
    hasRedeemableReveals: PropTypes.bool.isRequired,
    showSuccess: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
  };

  static contextType = I18nContext;

  sendRedeem = async () => {
    try {
      const res = await this.props.sendRedeem();
      if (res !== null) {
        this.props.showSuccess(this.context.t('redeemSuccess'));
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  render() {
    const { domain } = this.props;
    const { t } = this.context;
    const { info, bids = [] } = domain || {};
    const { highest, stats } = info || {};
    const { renewalPeriodEnd } = stats || {};

    return (
      <AuctionPanel>
        <AuctionPanelHeader title={t('closedAuctionTitle')}>
          <AuctionPanelHeaderRow label={t('expiresOn') + ':'}>
            <Blocktime
              height={renewalPeriodEnd}
              format="ll"
            />
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label={t('totalBids') + ':'}>
            {bids.length}
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label={t('highestBid') + ':'}>
            {displayBalance(highest, true)}
          </AuctionPanelHeaderRow>
        </AuctionPanelHeader>
        { this.renderFooter() }
      </AuctionPanel>
    );
  }

  renderFooter() {
    const { hasRedeemableReveals, domain, history, name } = this.props;
    const { t } = this.context;
    const isPending = domain.pendingOperation === 'REDEEM';

    return (
      <AuctionPanelFooter className="domains__action-panel__owned-actions">
        {
          hasRedeemableReveals && (
            <button
              className="domains__action-panel__redeem-btn"
              onClick={this.sendRedeem}
              disabled={isPending}
            >
              { isPending ? t('redeeming') : t('redeemMyBid')}
            </button>
          )
        }
        <button
          className="domains__action-panel__manage-domain-btn"
          onClick={() => history.push(`/domain_manager/${name}`)}
        >
          {t('viewDomainDetail')}
        </button>
      </AuctionPanelFooter>
    )
  }
}

export default withRouter(
  connect(
    (state, { domain }) => ({
      chain: state.node.chain,
      hasRedeemableReveals: _hasRedeemableReveals(domain),
    }),
    (dispatch, { name }) => ({
      sendRedeem: () => dispatch(names.sendRedeem(name)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      showError: (message) => dispatch(showError(message)),
    })
  )(Sold)
);

function _hasRedeemableReveals(domain) {
  const reveals = domain.reveals || [];

  for (let i = 0; i < reveals.length; i++) {
    const reveal = reveals[i];
    if (reveal.bid.own && reveal.height >= domain.info.height) {
      if (reveal.redeemable) {
        return true;
      }
    }
  }

  return false;
}
