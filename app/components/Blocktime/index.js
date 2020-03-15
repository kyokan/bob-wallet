import React, { Component } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { connect } from 'react-redux';

// 10 minute blocks
const AVERAGE_BLOCK_TIME = 10 * 60 * 1000;


@connect(
  (state) => ({
    currentHeight: state.node.chain.height,
  }),
)
export default class Blocktime extends Component {
  static propTypes = {
    height: PropTypes.number.isRequired,
    className: PropTypes.string,
    fromNow: PropTypes.bool,
    format: PropTypes.string,
  };

  static defaultProps = {
    className: '',
    fromNow: false,
    format: 'YYYY-MM-DD',
  };

  render() {
    return (
      <span className={this.props.className}>
        {this.renderTime()}
      </span>
    );
  }

  renderTime() {
    if (!this.props.height || !this.props.currentHeight) {
      return 'Loading...';
    }

    const delta = this.props.height - this.props.currentHeight;
    const end = moment().add(delta * AVERAGE_BLOCK_TIME);
    if (this.props.fromNow) {
      return '~' + end.toNow(true);
    }

    return end.format(this.props.format);
  }
}
