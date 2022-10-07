import React, { Component } from 'react';
import c from 'classnames';
import copy from 'copy-to-clipboard';
import PropTypes from 'prop-types';
import { I18nContext } from "../../utils/i18n";
import './copy-btn.scss';

export default class CopyButton extends Component {
  static propTypes = {
    content: PropTypes.string.isRequired,
    className: PropTypes.string.isRequired,
  };

  static defaultProps = {
    className: '',
  };

  static contextType = I18nContext;

  state = {
    hasCopied: false,
  };

  timer = null;

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  copyAddress = () => {
    copy(this.props.content);
    this.setState({ hasCopied: true });
    this.timer = setTimeout(() => {
      this.setState({ hasCopied: false });
      this.timer = null;
    }, 2500);
  };

  render() {
    const {t} = this.context;

    return (
      <button
        className={c('copy-btn', this.props.className, {
          'copy-btn--copied': this.state.hasCopied,
        })}
        onClick={this.copyAddress}
      >
        {this.state.hasCopied ? `${t('copied')}!` : t('copy')}
      </button>
    )
  }
}
