import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Modal from '../Modal';
import * as walletAction from '../../ducks/walletActions';
import './idle-modal.scss';

const MAX_IDLE = 5;

class IdleModal extends Component {
  static propTypes = {
    idle: PropTypes.number.isRequired,
    resetIdle: PropTypes.func.isRequired,
    logout: PropTypes.func.isRequired,
  };

  state = {
    isShowing: false,
    timeRemaining: 60,
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.isLocked && this.state.isShowing) {
      this.close();
      return;
    }

    if (!nextProps.isLocked && nextProps.idle >= MAX_IDLE && !this.state.isShowing) {
      if (!this.interval) {
        this.interval = setInterval(this.countDown, 1000);
      }
    }
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  logout = async () => {
    await this.props.logout();
    this.close();
  };

  extend = async () => {
    this.props.resetIdle();
    this.close();
  };

  close = () => {
    clearInterval(this.interval);
    this.interval = null;
    this.setState({
      timeRemaining: 60,
      isShowing: false,
    });
  };

  countDown = async () => {
    const {timeRemaining} = this.state;

    if (timeRemaining < 1) {
      await this.logout();
      return;
    }

    this.setState({
      isShowing: true,
      timeRemaining: timeRemaining - 1,
    });
  };

  render() {
    if (!this.state.isShowing) {
      return <noscript />;
    }

    return (
      <Modal className="idle-modal__wrapper" onClose={() => ({})}>
        <div className="idle-modal">
          <div className="idle-modal__title">You will be automatically logged out in:</div>
          <div className="idle-modal__time">{this.state.timeRemaining}s</div>
          <div className="idle-modal__actions">
            <button
              className="idle-modal__actions__extend"
              onClick={this.extend}
            >
              Extend
            </button>
            <button
              className="idle-modal__actions__logout"
              onClick={this.logout}
            >
              Logout
            </button>
          </div>
        </div>
      </Modal>
    );
  }
}

export default connect(
  state => ({
    idle: state.wallet.idle,
    isLocked: state.wallet.isLocked,
  }),
  dispatch => ({
    resetIdle: () => dispatch(walletAction.resetIdle()),
    logout: () => dispatch(walletAction.lockWallet()),
  }),
)(IdleModal);
