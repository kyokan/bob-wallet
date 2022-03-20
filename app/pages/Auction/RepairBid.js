import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment';
import {consensus} from 'hsd/lib/protocol';
import walletClient from '../../utils/walletClient';
import * as names from '../../ducks/names';
import { showError } from '../../ducks/notifications';
import {I18nContext} from "../../utils/i18n";
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import ProgressBar from '../../components/ProgressBar';
import './repair-bid.scss';

export class RepairBid extends Component {
  static propTypes = {
    bid: PropTypes.object.isRequired,
    findNonceProgress: PropTypes.object.isRequired,
    getNameInfo: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      isEditing: false,
      errorMessage: null,
      bidValue: '',
      rangeStart: '0',
      rangeEnd: '' + props.bid.mask / 1e6,
      precision: '0',
    };
  };

  /**
   * Verify bid value and optionally import nonce
   * @param {number} value bid value to verify
   * @param {boolean} storeNonce whether to import nonce or not
   * @returns if bid value is correct
   */
  async verifyBid(value, storeNonce) {
    const {bid} = this.props;
    try {
      const attempt = await walletClient.getNonce({
        name: bid.name,
        address: bid.from,
        bid: value * consensus.COIN
      });

      if (attempt.blind === bid.blind) {
        if (storeNonce) {
          await walletClient.importNonce({
            name: bid.name,
            address: bid.from,
            bid: value,
          });
          this.props.getNameInfo(bid.name);
        }

        return true;
      }
    } catch (e) {
      this.props.showError(e.message);
    }

    return false;
  }

  /**
   * Check if valid whole HNS value
   * @param {string} val string of number
   * @returns bool
   */
  isValueValid(val) {
    const value = val.match(/^[0-9]*\.?[0-9]{0,6}$/g)?.[0];
    const parsed = parseFloat(value);

    if (val === "" || Number.isNaN(parsed) || parsed * consensus.COIN > consensus.MAX_MONEY)
      return false;

    return true;
  }

  /**
   * Attempt to repair bid from input
   */
  testBidValue = async () => {
    const {bidValue} = this.state;
    if (!this.isValueValid(bidValue)) return;

    if (await this.verifyBid(parseFloat(bidValue), true)) {
      // Found value, close modal
      this.setState({isEditing: false});
    } else {
      this.setState({errorMessage: 'Bid value incorrect.'});
    }
  }

  /**
   * Check if brute force options are valid
   * @returns bool
   */
  isBruteForceOptionsValid = () => {
    const {mask} = this.props.bid;
    const {rangeStart, rangeEnd, precision} = this.state;

    if (![rangeStart, rangeEnd].every(this.isValueValid)) {
      return false;
    }

    const start = parseFloat(rangeStart);
    const end = parseFloat(rangeEnd);
    const prec = parseFloat(precision);

    if (start > end || start < 0 || end > (mask/1e6) || Number.isNaN(prec) || prec < 0 || prec > 6) {
      return false;
    }

    return true;
  }

  /**
   * Input change event handler
   * @param {string} name state key to set
   * @param {bool} clearError clear errorMessage?
   */
  onChange = (name, clearError) => (event) => {
    const {mask} = this.props.bid;
    const value = event.target.value;

    if (value.length) {
      if (name === 'bidValue' || name === 'rangeStart' || name === 'rangeEnd') {
        if (!this.isValueValid(value)) return;
      }

      if (name === 'rangeEnd') {
        const end = parseFloat(value);
        if (end > (mask/1e6)) return;
      }

      if (name === 'precision') {
        const prec = parseInt(value);
        if (prec < 0 || prec > 6 || prec >>> 0 !== prec) return;
      }
    }

    this.setState({
      [name]: value,
      errorMessage: clearError ? null : this.state.errorMessage,
    });
  };

  /**
   * Brute force bid using
   * start, end, precision
   */
  bruteForceBid = async () => {
    const {bid} = this.props;
    const {rangeStart, rangeEnd, precision} = this.state;

    const options = {
      name: bid.name,
      address: bid.from,
      expectedBlind: bid.blind,

      rangeStart: parseFloat(rangeStart) * 1e6,
      rangeEnd: parseFloat(rangeEnd) * 1e6,
      precision: parseInt(precision),
    }

    await walletClient.findNonce(options);
  }

  /**
   * Cancel brute force
   */
  cancelBruteForce = async () => {
    await walletClient.findNonceCancel();
  }

  render() {
    if (this.state.isEditing) {
      return (
        <>
          <span>Repairing...</span>
          {this.renderModal()}
        </>
      );
    }

    return this.renderRepairableBid();
  }

  renderRepairableBid() {
    const {t} = this.context;

    return (
      <div
        className="bid-history__repair-bid"
        onClick={() => {
          this.cancelBruteForce();
          this.setState({isEditing: true});
        }}
      >
        {`⚠️ ${t('unknownBid')}`}
      </div>
    );
  }

  renderModal() {
    const {t} = this.context;

    return (
      <Modal className="repair-bid" onClose={() => this.setState({isEditing: false})}>
        <div className="repair-bid__container">
          <div className="repair-bid__header">
            <div
              className="repair-bid__title">Repair bid</div>
            <div className="repair-bid__close-btn" onClick={() => this.setState({isEditing: false})}>
              ✕
            </div>
          </div>
          <div className="repair-bid__content">
            <p className="repair-bid__description">
              True bid values are secret until they are revealed on-chain and cannot be restored with just a seed phrase.
              To repair it, enter the bid value below.
            </p>

            {/* Single bid value test */}
            {this.renderModalBidTest()}

            <hr />

            {/* Brute force value */}
            {this.renderModalBruteForce()}
          </div>
        </div>
      </Modal>
    )
  }

  renderModalBidTest() {
    const {t} = this.context;
    const {bid} = this.props;
    const {bidValue, errorMessage} = this.state;

    return (
      <>
        <section className="repair-bid__bid-test">
          <div className="repair-bid__amount">
            <input
              placeholder="0.00"
              onChange={this.onChange('bidValue', true)}
              value={bidValue}
            />
            <div
              className="repair-bid__amount__max-btn"
              onClick={() => this.setState({bidValue: '' + bid.mask / 1e6})}
            >
              Max
            </div>
            <div className="repair-bid__amount__unit">HNS</div>
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={this.testBidValue}
            disabled={!this.isValueValid(bidValue)}
          >
            Repair
          </button>
        </section>

        <Alert type="error" message={errorMessage} style={{marginTop: '1rem'}} />
      </>
    )
  }

  renderModalBruteForce() {
    const {t} = this.context;
    const {bid, findNonceProgress} = this.props;
    const {rangeStart, rangeEnd, precision} = this.state;

    const start = parseFloat(rangeStart);
    const end = parseFloat(rangeEnd);
    const prec = parseInt(precision);

    const showBruteForceProgress = findNonceProgress.expectedBlind === bid.blind;
    let bruteForceAlertType, bruteForceAlertMessage;

    if (findNonceProgress.isFinding) {
      bruteForceAlertType = 'info';
      bruteForceAlertMessage = `Finding (${findNonceProgress.progress.toFixed(2)}% completed)... ${findNonceProgress.bidValue / 1e6} HNS`;
    } else {
      if (findNonceProgress.found) {
        bruteForceAlertType = 'success';
        bruteForceAlertMessage = `Found bid value: ${findNonceProgress.bidValue / 1e6} HNS`;
      } else {
        bruteForceAlertType = 'error';
        bruteForceAlertMessage = 'Could not find bid value. Try expanding the range or increasing precision.';
      }
    }

    let estDuration = null;
    if (this.isBruteForceOptionsValid()) {
      // 0.15 ms per 1 HNS; Exponential increase with precision
      estDuration = moment.duration(0.15 * (end-start) * (10**prec)).humanize();
    }

    return (
      <section className="repair-bid__brute-force">
        <p>Don't remember the amount? Fill in what you know below.</p>
        <span>Bid value range:</span>
        <div>
          <div className="repair-bid__amount">
            <input
              placeholder="0.00"
              onChange={this.onChange('rangeStart', false)}
              value={rangeStart}
            />
            <div
              className="repair-bid__amount__max-btn"
              onClick={() => this.setState({rangeStart: '0'})}
            >
              Min
            </div>
            <div className="repair-bid__amount__unit">HNS</div>
          </div>
          <span>to</span>
          <div className="repair-bid__amount">
            <input
              placeholder="0.00"
              onChange={this.onChange('rangeEnd', false)}
              value={rangeEnd}
            />
            <div
              className="repair-bid__amount__max-btn"
              onClick={() => this.setState({rangeEnd: '' + bid.mask / 1e6})}
            >
              Max
            </div>
            <div className="repair-bid__amount__unit">HNS</div>
          </div>
        </div>
        <div>
          <span>Max decimal places:</span>
          <div className="repair-bid__amount precision">
            <input
              type="number"
              placeholder="0"
              onChange={this.onChange('precision', false)}
              value={precision}
              min="0"
              max="6"
            />
          </div>
        </div>

        <p className="repair-bid__estimate-text">
          Will try all bid values from {Number.isNaN(start) ? '_____' : start} HNS to {Number.isNaN(end) ? '_____' : end} HNS in increments of {Number.isNaN(prec) ? '_____' : 1/10**prec}.<br />
          {estDuration ? <span>It may take <strong>~{estDuration}</strong> to try all values.</span> : null}
        </p>

        <div>
          <button
            className="domains__bid-now__action__cta"
            onClick={findNonceProgress.isFinding ? this.cancelBruteForce : this.bruteForceBid}
            disabled={!this.isBruteForceOptionsValid()}
          >
            {findNonceProgress.isFinding ? 'Cancel' : 'Find'}
          </button>
          {showBruteForceProgress ?
            <ProgressBar percentage={findNonceProgress.progress} />
            : null
          }
        </div>

        {showBruteForceProgress ? (
          <Alert type={bruteForceAlertType} message={bruteForceAlertMessage} />
        ) : null}
      </section>
    )
  }
}

export default connect(
  state => ({
    findNonceProgress: state.wallet.findNonceProgress,
  }),
  dispatch => ({
    getNameInfo: tld => dispatch(names.getNameInfo(tld)),
    showError: (message) => dispatch(showError(message)),
  }),
)(RepairBid);
