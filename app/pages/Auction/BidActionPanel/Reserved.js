import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  AuctionPanel,
  AuctionPanelFooter,
  AuctionPanelHeader,
  AuctionPanelHeaderRow
} from '../../../components/AuctionPanel';
import { displayBalance } from '../../../utils/balances';
import Blocktime from '../../../components/Blocktime';

export default class Reserved extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired,
  };

  render() {
    return (
      <AuctionPanel className="domains__action-panel__reserved">
        <div className="domains__action-panel__reserved-text">
          Reserved for ICANN TLDs and the top 100,000 Alexa websites
        </div>
        <div className="domains__action-panel__reserved-timestamp">
          In the reserved name list as of 2/1/20
        </div>
      </AuctionPanel>
    );
  }
}
