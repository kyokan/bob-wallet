import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import Modal from '../Modal';
import './proof-modal.scss';
import copy from 'copy-to-clipboard';

export default class ProofModal extends Component {
  static propTypes = {
    address: PropTypes.string.isRequired,
    stepOneInstruction: PropTypes.string.isRequired,
    stepTwoInstruction: PropTypes.string.isRequired,
    stepThreeInstruction: PropTypes.string.isRequired,
    stepOneDescription: PropTypes.string.isRequired,
    stepTwoDescription: PropTypes.string.isRequired,
    stepThreeDescription: PropTypes.string.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
  };

  static defaultProps = {
    address: '3P3QsMVK89JBNqZQv5zMAKG8FK3kJM4rjt'
  };

  state = {
    hasCopied: false
  };

  copyAddress = () => {
    copy(this.props.address);
    this.setState({ hasCopied: true });
    setTimeout(() => this.setState({ hasCopied: false }), 2500);
  };

  render() {
    const {
      onClose,
      address,
      stepOneInstruction,
      stepTwoInstruction,
      stepThreeInstruction,
      stepOneDescription,
      stepTwoDescription,
      stepThreeDescription,
      onSubmit
    } = this.props;
    const { hasCopied } = this.state;

    return (
      <Modal className="proof" onClose={onClose}>
        <div className="proof__container">
          <div className="proof__header">
            <div className="proof__title">Submit your SSH proof</div>
            <div className="proof__close-btn" onClick={onClose}>
              ✕
            </div>
          </div>
          <div className="proof__content">
            <div className="proof__step">
              <div className="proof__step-title">
                <span className="proof__step-title--bolded">Step 1:</span>
                <span>{stepOneInstruction}</span>
              </div>
              <div className="proof__step-description">{stepOneDescription}</div>
            </div>
            <div className="proof__step">
              <div className="proof__step-title">
                <span className="proof__step-title--bolded">Step 2:</span>
                <span>{stepTwoInstruction}</span>
              </div>
              <div className="proof__step-description">{stepTwoDescription}</div>
              <div className="proof__address-display">
                <div className="proof__address">{address}</div>
                <button
                  className={c('proof__copy-btn', {
                    'proof__copy-btn--copied': hasCopied
                  })}
                  onClick={this.copyAddress}
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="proof__step">
              <div className="proof__step-title">
                <span className="proof__step-title--bolded">Step 3:</span>
                <span>{stepThreeInstruction}</span>
              </div>
              <div className="proof__step-description">{stepThreeDescription}</div>
              <div className="proof__paste-area">
                <textarea placeholder="Paste proof content here" />
              </div>
            </div>
          </div>
          <div className="proof__footer">
            <button className="proof__details-btn" onClick={() => console.log('show details')}>
              See full details
            </button>
            <button className="proof__submit-btn" onClick={onSubmit}>
              Add Proof
            </button>
          </div>
        </div>
      </Modal>
    );
  }
}
