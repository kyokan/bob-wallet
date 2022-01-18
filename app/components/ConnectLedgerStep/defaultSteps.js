import React, { Component } from 'react';
import ConnectLedgerStep from './index';
import {I18nContext} from "../../utils/i18n";

export default class DefaultConnectLedgerSteps extends Component {
  static contextType = I18nContext;

  render() {
    const {completedSteps} = this.props;
    const {t} = this.context;

    return (
      <React.Fragment>
        <ConnectLedgerStep
          stepNumber={1}
          stepDescription={t('obLedgerStep1')}
          stepCompleted={completedSteps[0]}
        />
        <ConnectLedgerStep
          stepNumber={2}
          stepDescription={t('obLedgerStep2')}
          stepCompleted={completedSteps[1]}
        />
        <ConnectLedgerStep
          stepNumber={3}
          stepDescription={t('obLedgerStep3')}
          stepCompleted={completedSteps[2]}
        />
      </React.Fragment>
    )
  }

}
