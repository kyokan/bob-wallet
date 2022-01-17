import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  AuctionPanel,
} from '../../../components/AuctionPanel';
import {I18nContext} from "../../../utils/i18n";

export default class Reserved extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired,
  };

  static contextType = I18nContext;

  render() {
    return (
      <AuctionPanel className="domains__action-panel__reserved">
        <div className="domains__action-panel__reserved-text">
          {this.context.t('reservedText')}
        </div>
        <div className="domains__action-panel__reserved-timestamp">
          {this.context.t('reservedTimestamp')}
        </div>
      </AuctionPanel>
    );
  }
}
