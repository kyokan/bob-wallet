import React, { Component } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { connect } from 'react-redux';
import nodeClient from '../../utils/nodeClient';

// 5 minute blocks
const BLOCK_TIME = 5 * 60 * 1000;

let firstBlock = null;
let deferred = null;
let cachedNet = null;

// use this function to make sure that multiple components
// rendered at once don't fire off multiple requests at once.
async function getFirstBlockTime(net) {
  if (firstBlock && net === cachedNet) {
    return firstBlock
  }

  if (deferred) {
    return deferred;
  }

  cachedNet = net;
  deferred = new Promise((resolve, reject) => nodeClient.getBlockByHeight(1, true).then((res) => {
    firstBlock = res;
    deferred = null;
    resolve(firstBlock);
  }).catch(() => {
    deferred = null;
    reject();
  }));
  return deferred;
}

@connect(
  (state) => ({
    network: state.node.network,
  })
)
export default class Blocktime extends Component {
  static propTypes = {
    network: PropTypes.string.isRequired,
    height: PropTypes.number.isRequired,
    className: PropTypes.string,
    fromNow: PropTypes.bool,
  };

  static defaultProps = {
    className: '',
    fromNow: false,
  };

  state = {
    time: null,
  };

  async componentWillMount() {
    await this.getBlockTime();
  }

  render() {
    return (
      <span className={this.props.className}>
        {this.renderTime()}
      </span>
    );
  }

  renderTime() {
    if (!this.state.time) {
      return 'Loading...';
    }

    return this.state.time;
  }

  async getBlockTime() {
    const block = await getFirstBlockTime(this.props.network);
    const start = moment.unix(block.time);
    const delta = this.props.height * BLOCK_TIME;
    const end = start.add(delta);

    if (this.props.fromNow) {
      this.setState({
        time: '~' + end.toNow(true)
      });
      return;
    }

    this.setState({
      time: end.format('YYYY-MM-DD')
    });
  }
}

export const returnBlockTime = async (height, network) => {
    const block = await getFirstBlockTime(network);
    const start = moment.unix(block.time);
    const delta = height * BLOCK_TIME;
    const end = start.add(delta);
    return end
}
