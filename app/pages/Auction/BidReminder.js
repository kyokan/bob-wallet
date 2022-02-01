import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Blocktime from '../../components/Blocktime';
import moment from 'moment';
import {I18nContext} from "../../utils/i18n";

export default class BidReminder extends Component {
  static propTypes = {
    domain: PropTypes.object,
  };

  static contextType = I18nContext;

  render() {
    const { domain } = this.props;
    const {t} = this.context;

    return (
      <div className="domains__action-panel domains__action-panel--gray">
        <div className="domains__action-panel__reminder-title">
          <span>{t('bidReminderTitle')}</span>
          <Blocktime
            className="domains__action-panel__reminder-date"
            height={0}
            adjust={d => moment(d).add(domain.start.week, 'w')}
          />
        </div>
        <div className="domains__action-panel__reminder-link">
          {t('setReminder')}
        </div>
      </div>
    );
  }
}
