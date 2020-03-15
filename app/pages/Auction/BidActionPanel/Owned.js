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

class Owned extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    chain: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired,
    sendRenewal: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
  };

  sendRenewal = () => {
    this.props.sendRenewal()
      .then(() => this.props.showSuccess('Your renew request is submitted! Please wait around 15 minutes for it to be confirmed.'))
      .catch(e => this.props.showError(e.message))
  };

  render() {
    const { domain, history, name, chain } = this.props;
    const { info, bids = [] } = domain || {};
    const { highest, stats } = info || {};
    const { renewalPeriodStart, renewalPeriodEnd } = stats || {};
    const isPending = domain.pendingOperation === 'RENEW';

    return (
      <AuctionPanel>
        <AuctionPanelHeader title="You are the owner of this domain!">
          <AuctionPanelHeaderRow label="Expires On:">
            <Blocktime
              height={renewalPeriodEnd}
              format="ll"
            />
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Total Bids:">
            {bids.length}
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Highest Bid:">
            {displayBalance(highest, true)}
          </AuctionPanelHeaderRow>
        </AuctionPanelHeader>
        <AuctionPanelFooter className="domains__action-panel__owned-actions">
          <button
            className="domains__action-panel__renew-domain-btn"
            onClick={this.sendRenewal}
            disabled={isPending || !chain || chain.height < renewalPeriodStart}
          >
            { isPending ? 'Renewing': 'Renew my domain' }
          </button>
          <button
            className="domains__action-panel__manage-domain-btn"
            onClick={() => history.push(`/domain_manager/${name}`)}
          >
            Manage my domain
          </button>
        </AuctionPanelFooter>
      </AuctionPanel>
    );
  }
}

export default withRouter(
  connect(
    state => ({
      chain: state.node.chain,
    }),
    (dispatch, { name }) => ({
      sendRenewal: () => dispatch(names.sendRenewal(name)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      showError: (message) => dispatch(showError(message)),
    })
  )(Owned)
);
