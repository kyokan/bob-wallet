import React, { Component } from 'react';
import MiniModal from '../../components/Modal/MiniModal';
import './account-index-modal.scss';

export default class AccountIndexModal extends Component {
  render() {
    return (
      <MiniModal title="Change account index" closeRoute="/settings" centered>
        <div className="account-index-modal__instructions">
          Enter an account index you would like to <br /> interact with.
        </div>
        <div className="account-index-modal__path">
          m / 44' / 5353' /{' '}
          <input
            type="text"
            placeholder="0"
            className="account-index-modal__path-entry"
            autoFocus
          />
        </div>
        <button className="account-index-modal__submit">Change index</button>
      </MiniModal>
    );
  }
}
