import React, { Component } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { getBlockByHeight } from '../../utils/block-helpers';

export default class Blocktime extends Component {
  static propTypes = {
    height: PropTypes.number.isRequired,
    adjust: PropTypes.func,
    className: PropTypes.string,
    fromNow: PropTypes.bool,
  };

  static defaultProps = {
    className: '',
    adjust: date => date,
    fromNow: false,
  };

  state = {
    block: null,
  };

  async componentWillMount() {
    const { result } = await getBlockByHeight(this.props.height);
    this.setState({ block: result });
  }

  render() {
    return (
      <span className={this.props.className}>
        {this.getBlocktime()}
      </span>
    )
  }

  getBlocktime() {
    const { fromNow } = this.props;
    const { block } = this.state;

    if (!block || !block.time) {
      return 'Loading...';
    }

    if (fromNow) {
      console.log(this.props.adjust(moment.unix(block.time)).format('YYYY-MM-DD'))
      return '~' + this.props.adjust(moment.unix(block.time)).toNow(true);
    }

    return this.props.adjust(moment.unix(block.time)).format('YYYY-MM-DD');
  }
}
