import React from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';

import Terms from '../Terms/index';
import ConnectLedger from '../ConnectLedger/index';

// wizard header
const TERM_OF_USE = 'TERM_OF_USE';
const CONNECT_LEDGER = 'CONNECT_LEDGER';

@withRouter
class ConnectLedgerFlow extends React.Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func
    }).isRequired
  };

  state = {
    currentStep: TERM_OF_USE
  };

  render() {
    return this.state.currentStep === TERM_OF_USE ? (
      <Terms
        onAccept={() => this.setState({ currentStep: CONNECT_LEDGER })}
        onBack={() => this.props.history.push('/existing-options')}
      />
    ) : (
      <ConnectLedger
        onBack={() => this.setState({ currentStep: TERM_OF_USE })}
        onCancel={() => this.props.history.push('/funding-options')}
      />
    );
  }
}

export default ConnectLedgerFlow;
