import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';
import * as walletActions from '../../ducks/walletActions';
import './login.scss';
import Submittable from '../../components/Submittable';
import { Link } from 'react-router-dom';

@connect(
  () => ({}),
  dispatch => ({
    unlockWallet: passphrase => dispatch(walletActions.unlockWallet(passphrase))
  })
)
export default class AccountLogin extends Component {
  static propTypes = {
    unlockWallet: PropTypes.func.isRequired
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
      await this.props.unlockWallet(passphrase);
    } catch (error) {
      return this.setState({ showError: true });
    }
  }

  render() {
    const { passphrase, showError } = this.state;

    return (
      <div className="login">
        <div className="login_header_text">Log in to your wallet</div>
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
          Unlock Wallet
        </button>
        <div className="login_subheader_text">Forgot your password?</div>
        <Link
          to="/import-seed"
          className="login_subheader_text login_subheader_text__accent"
        >
          Restore with your seed phrase
        </Link>
      </div>
    );
  }
}
