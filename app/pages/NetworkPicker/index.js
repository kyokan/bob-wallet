import React, { Component } from 'react';
import Dropdown from '../../components/Dropdown';
import { NETWORKS } from '../../constants/networks';
import { withRouter } from 'react-router-dom';
import connect from 'react-redux/es/connect/connect';
import * as nodeActions from '../../ducks/node';
import './network-picker.scss';

const dummyItems = [
  {
    label: '--',
    disabled: true,
  },
];

const networks = [
  {
    label: 'Mainnet',
  },
  {
    label: 'Testnet',
  },
  {
    label: 'Simnet',
  },
  {
    label: 'Regtest',
  },
];

const networksIndices = {
  [NETWORKS.MAINNET]: 0,
  [NETWORKS.TESTNET]: 1,
  [NETWORKS.SIMNET]: 2,
  [NETWORKS.REGTEST]: 3,
};

const indicesNetworks = [
  NETWORKS.MAINNET,
  NETWORKS.TESTNET,
  NETWORKS.SIMNET,
  NETWORKS.REGTEST,
];

@withRouter
@connect(
  (state) => ({
    network: state.node.network,
  }),
  dispatch => ({
    changeNetwork: (net) => dispatch(nodeActions.changeNetwork(net)),
  }),
)
export default class NetworkPicker extends Component {
  render() {
    if (!this.props.network) {
      return (
        <div className="network-picker">
          <Dropdown
            items={dummyItems}
            currentIndex={0}
          />
        </div>
      );
    }

    return (
      <div className="network-picker">
        <Dropdown
          reversed
          items={networks}
          currentIndex={networksIndices[this.props.network]}
          onChange={(i) => this.props.changeNetwork(indicesNetworks[i])}
        />
      </div>
    );
  }
}
