import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { shell } from 'electron';
import {
  AuctionPanel,
} from '../../../components/AuctionPanel';
import { I18nContext } from "../../../utils/i18n";

export default class Reserved extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    name: PropTypes.string.isRequired,
    locked: PropTypes.bool.isRequired,
  };

  static contextType = I18nContext;

  render() {
    const { t } = this.context;
    const { locked } = this.props;

    return (
      <AuctionPanel className="domains__action-panel__reserved">
        <div className="domains__action-panel__reserved-text">
          {locked ? t('lockedText') : t('reservedText')}
        </div>
        <div className="domains__action-panel__reserved-timestamp">
          {locked ?
            <>
              <span>
                {t('lockedDescription')}
              </span>
              <p>
                <a
                  className="anchor"
                  onClick={() => shell.openExternal(t('lockedLearnMoreURL'))}
                >
                  {t('learnMore')}
                </a>
              </p>
            </>
            : t('reservedTimestamp')
          }
        </div>
      </AuctionPanel>
    );
  }
}
