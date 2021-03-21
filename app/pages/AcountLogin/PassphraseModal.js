import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';
import * as walletActions from '../../ducks/walletActions';
import './login.scss';
import Submittable from '../../components/Submittable';
import MiniModal from '../../components/Modal/MiniModal';

@connect(
  (state) => ({
    getPassphrase: state.wallet.getPassphrase,
    wid: state.wallet.wid,
  }),
  dispatch => ({
    unlockWallet: (name, passphrase) => dispatch(walletActions.unlockWallet(name, passphrase)),
    closeGetPassphrase: () => dispatch(walletActions.closeGetPassphrase()),
  })
)
export default class PassphraseModal extends Component {
  static propTypes = {
    wid: PropTypes.string.isRequired,
    unlockWallet: PropTypes.func.isRequired,
    closeGetPassphrase: PropTypes.func.isRequired,
    getPassphrase: PropTypes.object.isRequired,
  };

  static defaultProps = {
    className: ''
  };

  state = {
    passphrase: '',
    showError: false
  };

  async handleLogin(passphrase) {
    try {
      const {wid, unlockWallet, getPassphrase, closeGetPassphrase} = this.props;
      await unlockWallet(wid, passphrase);
      this.setState({passphrase: ''});
      getPassphrase.resolve(passphrase);
      closeGetPassphrase();
    } catch (error) {
      return this.setState({ showError: true });
    }
  }

  onClose = () => {
    this.setState({passphrase:'', showError: false});
    this.props.getPassphrase.reject({message: 'No Password'});
    this.props.closeGetPassphrase();
  };

  render() {
    const { passphrase, showError } = this.state;

    if (!this.props.getPassphrase.get)
      return null;

    return (
      <MiniModal
        onClose={this.onClose}
        title="Enter Password"
        centered
      >
        <Submittable onSubmit={() => this.handleLogin(passphrase)}>
          <div>
            <input
              className={c('login_password_input', {
                'login_password_input--error': showError
              })}
              type="password"
              placeholder="Your password"
              onChange={e =>
                this.setState({ passphrase: e.target.value, showError: false })
              }
              value={passphrase}
              autoFocus
            />
          </div>
          <div className="login_password_error">
            {showError && `Invalid password.`}
          </div>
        </Submittable>
        <button
          className="extension_cta_button login_cta"
          onClick={() => this.handleLogin(passphrase)}
        >
          Submit
        </button>
      </MiniModal>
    );
  }
}
