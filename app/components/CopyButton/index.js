import React, { Component } from 'react';
import c from 'classnames';
import copy from 'copy-to-clipboard';
import PropTypes from 'prop-types';
import './copy-btn.scss';

export default class CopyButton extends Component {
  static propTypes = {
    content: PropTypes.string.isRequired,
    className: PropTypes.string.isRequired,
  };

  static defaultProps = {
    className: '',
  };

  state = {
    hasCopied: false,
  };

  copyAddress = () => {
    copy(this.props.content);
    this.setState({ hasCopied: true });
    setTimeout(() => this.setState({ hasCopied: false }), 2500);
  };

  render() {
    return (
      <button
        className={c('copy-btn', this.props.className, {
          'copy-btn--copied': this.state.hasCopied,
        })}
        onClick={this.copyAddress}
      >
        Copy
      </button>
    )
  }
}
