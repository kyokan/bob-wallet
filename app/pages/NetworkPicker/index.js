import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Dropdown from '../../components/Dropdown';
import { NETWORKS } from '../../constants/networks';
import { withRouter } from 'react-router-dom';
import connect from 'react-redux/es/connect/connect';
import * as nodeActions from '../../ducks/node';
import c from 'classnames';
import './network-picker.scss';

const dummyItems = [
  {
    label: '--',
    disabled: true,
  },
];

export const networks = [
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

export const networksIndices = {
  [NETWORKS.MAINNET]: 0,
  [NETWORKS.TESTNET]: 1,
  [NETWORKS.SIMNET]: 2,
  [NETWORKS.REGTEST]: 3,
};

export const indicesNetworks = [
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
  (dispatch) => ({
    changeNetwork: (net) => dispatch(nodeActions.changeNetwork(net)),
  }),
)
export default class NetworkPicker extends Component {
  static propTypes = {
    network: PropTypes.string.isRequired,
    changeNetwork: PropTypes.func.isRequired,
    className: PropTypes.string,
    currentNetwork: PropTypes.string,
    onNetworkChange: PropTypes.func,
  };

  render() {
    const {
      changeNetwork,
      onNetworkChange,
      className,
      network,
      currentNetwork,
    } = this.props;

    const net = currentNetwork || network;

    if (!net) {
      return (
        <div className={c('network-picker', className)}>
          <Dropdown
            items={dummyItems}
            currentIndex={0}
          />
        </div>
      );
    }

    return (
      <div className={c('network-picker', className)}>
        <Dropdown
          reversed
          items={networks}
          currentIndex={networksIndices[net]}
          onChange={(i) => {
            if (onNetworkChange) {
              onNetworkChange(indicesNetworks[i]);
            } else {
              changeNetwork(indicesNetworks[i])
            }
          }}
        />
      </div>
    );
  }
}
