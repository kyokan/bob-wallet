import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as walletActions from '../../ducks/wallet';
import './login.scss';
import Submittable from '../../components/Submittable';
import { Link } from 'react-router-dom';

@connect(
  () => ({}),
  dispatch => ({
    unlockWallet: passphrase => dispatch(walletActions.unlockWallet(passphrase)),
  }),
)
export default class AccountLogin extends Component {
  static propTypes = {
    unlockWallet: PropTypes.func.isRequired,
  };

  static defaultProps = {
    className: '',
  };

  state = {
    passphrase: '',
  };

  render() {
    const {passphrase} = this.state;

    return (
      <div className="login extension_primary_section">
        <div className="header_text"> Log in to your wallet</div>
        <Submittable onSubmit={() => this.props.unlockWallet(passphrase)}>
          <div>
            <input
              className="login_password_input"
              type="password"
              placeholder="Your password"
              onChange={e => this.setState({passphrase: e.target.value})}
              value={passphrase}
              autoFocus
            />
          </div>
        </Submittable>
        <button
          className="extension_cta_button login_cta"
          onClick={() => this.props.unlockWallet(passphrase)}
        >
          Unlock Wallet
        </button>
        <div className="login_options_wrapper">
          <div className="login_subheader_text">
            Forgot your password?
          </div>
          <Link to="/import-seed" className="login_subheader_text login_subheader_text__accent">
            Restore with your seed phrase
          </Link>
        </div>
      </div>
    );
  }
}
