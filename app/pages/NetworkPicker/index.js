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
    disabled: true,
  },
  {
    label: 'Testnet',
    disabled: true,
  },
  {
    label: 'Simnet',
  },
  {
    label: 'Regtest',
    disabled: true,
  },
];

const networksIndices = {
  [NETWORKS.SIMNET]: 2,
};

const indicesNetworks = [
  NETWORKS.SIMNET,
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
