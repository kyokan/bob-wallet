import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import "./name-claim-modal.scss";
import Modal from "../Modal";
import Alert from "../Alert";

@connect(
  state => ({

  }),
)
export default class NameClaimModal extends Component {
  render() {
    const {
      onClose,
    } = this.props;

    return (
      <Modal className="name-claim" onClose={onClose}>
        <div className="name-claim__container">
          <div className="name-claim__header">
            <div
              className="name-claim__title"
            >
              Reserved Name Claim
            </div>
            <div className="name-claim__close-btn" onClick={onClose}>
              ✕
            </div>
          </div>
        </div>
      </Modal>
    );
  }
}
