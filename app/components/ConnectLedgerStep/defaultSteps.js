import React, { Component } from 'react';
import ConnectLedgerStep from './index';

export default function DefaultConnectLedgerSteps(props) {
  return (
    <React.Fragment>
      <ConnectLedgerStep
        stepNumber={1}
        stepDescription="Connect your Ledger directly to your computer."
        stepCompleted={props.completedSteps[0]}
      />
      <ConnectLedgerStep
        stepNumber={2}
        stepDescription="Enter your secret pin on your Ledger device."
        stepCompleted={props.completedSteps[1]}
      />
      <ConnectLedgerStep
        stepNumber={3}
        stepDescription="Select the Handshake app on your Ledger."
        stepCompleted={props.completedSteps[2]}
      />
    </React.Fragment>
  )
}
