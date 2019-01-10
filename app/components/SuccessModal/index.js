import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import './successmodal.scss';

const modalRoot = document.querySelector('#modal-root');

class SuccessModal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    className: PropTypes.string,
    children: PropTypes.node,
  };

  static defaultProps = {
    className: '',
  };

  render() {
    const { className, onClose, children } = this.props;

    return ReactDOM.createPortal(
      <div className="success_modal__overlay" onClick={onClose}>
        <div className={`success_modal__wrapper ${className}`} onClick={e => e.stopPropagation()}>
        <div className='success_modal__close_icon' onClick={onClose} />
          <div className='success_modal__headline'>
            <div className='success_modal__success_icon' />
            <div className='success_modal__headline__title'>Bid Placed</div>
            <div className='success_modal__description'>Your Bid</div>
            <div className='success_modal__value'>20.00 HNS</div>
            <div className='success_modal__description'>Your Mask</div>
            <div className='success_modal__value'>1.00 HNS</div>
            <div className='success_modal__reveal_wrapper'>
              <div className='success_modal__description'>Reveal Period:</div>
              <div className='success_modal__value'>01/31/19 - 02/02/19</div>
              <div className='success_modal__value--date'>Block # 2039 - 3395</div>
            </div>
          </div>

          {children}
        </div>
      </div>,
      modalRoot,
    );
  }
}

export default SuccessModal;
