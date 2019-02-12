import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import Blocktime from '../Blocktime';
import './SuccessModal.scss';

const modalRoot = document.querySelector('#modal-root');

class SuccessModal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    className: PropTypes.string,
    bidAmount: PropTypes.string,
    maskAmount: PropTypes.number,
    revealStartBlock: PropTypes.number,
  };

  static defaultProps = {
    className: '',
    bidAmount: 0,
    maskAmount: 0,
    revealStartBlock: '0',
  };

  render() {
    const { className, onClose, bidAmount, maskAmount, revealStartBlock } = this.props;

    return ReactDOM.createPortal(
      <div className="success_modal__overlay" onClick={onClose}>
        <div className={`success_modal__wrapper ${className}`} onClick={e => e.stopPropagation()}>
        <div className='success_modal__close_icon' onClick={onClose} />
          <div className='success_modal__headline'>
            <div className='success_modal__success_icon' />
            <div className='success_modal__headline__title'>Bid Placed</div>
            <div className='success_modal__description'>Your Bid</div>
            <div className='success_modal__value'>{`${bidAmount} HNS`}</div>
            <div className='success_modal__description'>Your Mask</div>
            <div className='success_modal__value'>{maskAmount? `${maskAmount} HNS` : ' - '}</div>
            <div className='success_modal__reveal_wrapper'>
              <div className='success_modal__description'>Reveal Start:</div>
              <div className='success_modal__value'><Blocktime height={revealStartBlock} fromNow /></div>
              <div className='success_modal__value--date'>Block # {revealStartBlock}</div>
            </div>
          </div>
        </div>
      </div>,
      modalRoot,
    );
  }
}

export default SuccessModal;
