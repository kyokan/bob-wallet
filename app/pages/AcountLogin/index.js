import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import c from 'classnames';
import * as walletActions from '../../ducks/walletActions';
import './login.scss';
import Submittable from '../../components/Submittable';
import { Link, Redirect } from 'react-router-dom';
import Dropdown from '../../components/Dropdown';
import { withRouter } from 'react-router';
import walletClient from "../../utils/walletClient";
import { getWalletPassHash } from '../../db/system';
import { verifyBcryptHash } from '../../utils/encrypt';

@connect(
  (state) => ({
    wallets: state.wallet.wallets,
    walletsDetails: state.wallet.walletsDetails,
  }),
  dispatch => ({
    unlockWallet: (name, passphrase) => dispatch(walletActions.unlockWallet(name, passphrase)),
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
  }),
)
@withRouter
export default class AccountLogin extends Component {
  static propTypes = {
    unlockWallet: PropTypes.func.isRequired,
  };

  static defaultProps = {
    className: '',
  };

  state = {
    passphrase: '',
    showError: false,
    chosenWallet: 0,
  };

  async handleLogin(passphrase) {
    try {
      const walletName = this.props.wallets[this.state.chosenWallet];
      const isLedgerWallet = this.props.walletsDetails[walletName].watchOnly;

      // For ledger, verify password only if hash is stored.
      if (isLedgerWallet) {
        const expectedHash = await getWalletPassHash(walletName);
        if (expectedHash !== null) {
          const isValid = await verifyBcryptHash(passphrase, expectedHash);
          if(!isValid) {
            throw new Error('Invalid password.');
          }
        }
      }

      await this.props.unlockWallet(
        walletName,
        passphrase,
      );
      await this.props.fetchWallet();
      this.props.history.push('/account');
      await walletClient.lock();
    } catch (error) {
      return this.setState({showError: true});
    }
  }

  render() {
    const {passphrase, showError} = this.state;
    const {walletsDetails} = this.props;

    if (!this.props.wallets.length) {
      return <Redirect to="/funding-options" />;
    }

    return (
      <div className="login">
        <div className="login_header_text">Log in to your wallet</div>
        <Submittable onSubmit={() => this.handleLogin(passphrase)}>
          <Dropdown
            items={this.props.wallets.map((w) => ({
              label: w + ((walletsDetails[w] && walletsDetails[w].watchOnly) ? " (Ledger)" : ""),
            }))}
            currentIndex={this.state.chosenWallet}
            onChange={(i) => this.setState({ chosenWallet: i })}
          />
          <div>
            <input
              className={c("login_password_input", {
                "login_password_input--error": showError,
              })}
              type="password"
              placeholder="Your password"
              onChange={(e) =>
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
        <Link
          to="/funding-options"
          className="login_subheader_text login_subheader_text__accent"
        >
          Create new wallet
        </Link>
      </div>
    );
  }
}
