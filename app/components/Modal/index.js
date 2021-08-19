import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import './modal.scss';

const modalRoot = document.querySelector('#modal-root');

class Modal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    className: PropTypes.string,
    children: PropTypes.node,
  };

  static defaultProps = {
    className: '',
  };

  onClose = e => {
    const selected = window.getSelection().toString();
    if (selected || !this.props.onClose) {
      return;
    }
    this.props.onClose();
  };

  render() {
    const { className, onClose, children } = this.props;

    return ReactDOM.createPortal(
      <div
        className="modal__overlay"
        onClick={this.onClose}
      >
        <div className={`modal__wrapper ${className}`} onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>,
      modalRoot,
    );
  }
}

export default Modal;
