import React, { Component } from 'react';
import Modal from './index';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import './mini-modal.scss';

@withRouter
export class MiniModal extends Component {
  static propTypes = {
    closeRoute: PropTypes.string,
    onClose: PropTypes.func,
    children: PropTypes.node.isRequired,
    title: PropTypes.string.isRequired,
    className: PropTypes.string,
    centered: PropTypes.bool,
    wide: PropTypes.bool,
    top: PropTypes.bool,
    overflow: PropTypes.bool,
  };

  onClose = () => {
    if (this.props.onClose)
      return this.props.onClose();

    this.props.closeRoute
    ? this.props.history.push(this.props.closeRoute)
    : this.props.history.goBack();
  };

  render() {
    const names = classnames('mini-modal', this.props.className, {
      'mini-modal--centered': this.props.centered,
      'mini-modal--wide': this.props.wide,
      'mini-modal--tip': this.props.top,
      'mini-modal--overflow': this.props.overflow,
    });

    return (
      <Modal className={names} onClose={this.onClose}>
        <div className="mini-modal__header">
          <div className="mini-modal__title">
            {this.props.title}
          </div>
          <div className="mini-modal__close" onClick={this.onClose} />
        </div>
        <div className="mini-modal__content">
          {this.props.children}
        </div>
      </Modal>
    )
  }
}

export default withRouter(MiniModal);
