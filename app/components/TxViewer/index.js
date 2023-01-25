import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from "prop-types";
import {I18nContext} from "../../utils/i18n";
import './tx-viewer.scss';

@connect(
  (state) => ({
    walletId: state.wallet.wid,
    accountKey: state.wallet.accountKey,
    walletKeysNames: state.wallet.keysNames,
  }),
)
export default class TxViewer extends Component {
  static propTypes = {
    walletId: PropTypes.string.isRequired,
    accountKey: PropTypes.string.isRequired,
    walletKeysNames: PropTypes.object.isRequired,
    tx: PropTypes.object,
    multisigInfo: PropTypes.array,
    signerData: PropTypes.array,
    metadata: PropTypes.object,
  }

  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      isAdvancedExpanded: false,
    };
  }

  render() {
    const { t } = this.context;
    const { tx, multisigInfo, signerData } = this.props;
    const { isAdvancedExpanded } = this.state;

    if (!tx) return null;

    // Show multisig state based on first own input
    const ownInputIdx = getOwnMultisigInputIndex(signerData);
    const {m, n} = multisigInfo[ownInputIdx] || {};

    return (
      <div className="tx-viewer">
        <p className="tx-viewer__title">
          Transaction {tx.hash}
        </p>

        <p className="tx-viewer__heading">Contains:</p>
        {this.renderContent()}

        <p className="tx-viewer__fee">
          Fee: {tx.fee / 1e6} HNS ({tx.rate / 1e6} HNS/kB)
        </p>

        <p className="tx-viewer__heading">
          Multisig
          {n && ` (${m}-of-${n})`}
          :
        </p>
        {this.renderMultisig(ownInputIdx)}

        <p
          className="tx-viewer__heading link"
          onClick={() => this.setState({isAdvancedExpanded: !isAdvancedExpanded})}
        >
          Advanced View »
        </p>
        {isAdvancedExpanded && this.renderAdvanced()}
      </div>
    )
  }

  renderContent = () => {
    const { t } = this.context;
    const { tx, metadata } = this.props;

    const pills = getPillsText(tx, metadata);

    return (
      <div className="tx-viewer__section section__content">
        {pills.map((pill, idx) => <div key={idx}>{pill}</div>)}
      </div>
    );
  }

  renderMultisig = (ownInputIdx) => {
    const { t } = this.context;
    const {
      multisigInfo,
      signerData,
      accountKey,
      walletKeysNames,
      walletId
    } = this.props;

    const {m, n} = multisigInfo[ownInputIdx] || {};

    // Separate signers with and without sigs
    const signed = [];
    const notSigned = [];
    for (const signer of signerData[ownInputIdx]) {
      if (signer.signed)
        signed.push(signer);
      else
        notSigned.push(signer);
    }

    // Percentages for pie chart
    const pie = {
      signed: `${signed.length * 100 / n}%`,
      required: `${Math.max(0, (m-signed.length)) * 100 / n}%`,
    };

    return (
      <div className="tx-viewer__section section__multisig">

        {/* Pie chart */}
        <div
          className="pie"
          style={{
            '--ms-pie-signed': pie.signed,
            '--ms-pie-required': pie.required,
          }}
        ></div>

        {/* Signed list */}
        <div>
          <p>
            {signed.length ?
              `Has been signed by ${signed.length} members:`
              : 'No member has signed this transaction yet.'
            }
          </p>
          <div className="tx-viewer__sigs">
            {signed.map((signer, idx) => (
              <div key={idx} className="signed">
                {(signer.accountKey === accountKey) ?
                  (`${walletId} (me)`)
                  : walletKeysNames[signer.accountKey] || `unknown-signer #${idx}`
                }
              </div>
            ))}
          </div>
        </div>

        {/* Not signed list */}
        <div>
          <p>
            {signed.length < m ?
              `Requires ${m-signed.length} signatures from any of:`
              : 'Has enough signatures and is valid! Other members:'
            }
          </p>
          <div className="tx-viewer__sigs">
            {notSigned.map((signer, idx) => (
              <div key={idx} className={signed.length < m ? "potential" : ""}>
                {(signer.accountKey === accountKey) ?
                  (`${walletId} (me)`)
                  : walletKeysNames[signer.accountKey] || `unknown-signer #${idx}`
                }
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  renderAdvanced = () => {
    const { t } = this.context;
    const { tx } = this.props;

    return (
      <div className="tx-viewer__adv">
        {/* Inputs */}
        <div>
          <h4 className="tx-viewer__adv__heading">{t('inputs')}</h4>
          {tx.inputs.map((input, inputIdx) => this.renderInput(input, inputIdx))}
        </div>

        {/* Outputs */}
        <div>
          <h4 className="tx-viewer__adv__heading">{t('outputs')}</h4>
          {tx.outputs.map((output, outputIdx) => this.renderOutput(output, outputIdx))}
        </div>
      </div>
    );
  }

  renderInput = (input, inputIdx) => {
    const { signerData, accountKey, walletKeysNames, walletId } = this.props;
    const { hash } = input.prevout;

    return (
      <div key={inputIdx} className="tx-viewer__card">
        <div className="tx-viewer__card__desc">
          <span title={hash}>({hash.slice(0, -6)}</span>
          <span title={hash}>{hash.slice(-6)}, {input.prevout.index})</span>
          <span>
            {input.coin ?
              `${input.coin.value / 1e6} HNS`
              : `${t('unknown')} HNS`
            }
          </span>
        </div>
        {signerData && signerData[inputIdx] && (
          <div className="tx-viewer__sigs">
            {signerData[inputIdx].map((signer, idx) => (
              <div key={idx} className={signer.signed ? 'signed' : ''}>
                {(signer.accountKey === accountKey) ?
                  (`${walletId} (me)`)
                  : walletKeysNames[signer.accountKey] || `unknown-signer #${idx}`
                }
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  renderOutput = (output, outputIdx) => {
    const { t } = this.context;

    return (
      <div key={outputIdx} className="tx-viewer__card">
        <div className="tx-viewer__card__desc">
          <span title={output.address}>
            {output.path && `${t('own')} `}
            {output.address.slice(0, -6)}
          </span>
          <span title={output.address}>{output.address.slice(-6)}</span>
          <span>{output.value / 1e6} HNS</span>
        </div>
        {this.renderCovenant(output, outputIdx)}
      </div>
    );
  }

  renderCovenant = (output, outputIdx) => {
    const { metadata } = this.props;
    const { covenant } = output;

    // Hide on NONE type
    if (covenant.type === 0) {
      return null;
    }

    return (
      <div className="tx-viewer__card__covenant">
        <div className="tx-viewer__card__covenant__header">
          <span>{covenant.action}</span>
          <span>{metadata.outputs[outputIdx].name || 'unknown name!'}/</span>
        </div>

        {covenant.action === 'BID' &&
          <div className="tx-viewer__card__covenant__bid">
            {metadata.outputs[outputIdx].bid / 1e6} HNS bid +
            {(output.value - metadata.outputs[outputIdx].bid) / 1e6} HNS blind
          </div>
        }
      </div>
    );
  }
}

function getPillsText(tx, metadata) {
  // Handle atomic swap separately
  const atomicSwap = parseAtomicSwap(tx, metadata);
  if (atomicSwap) {
    return [
      atomicSwap.receiving ?
        `FINALIZE with Payment (buy) • ${atomicSwap.value} HNS`
        : `FINALIZE with Payment (sell) • ${atomicSwap.value} HNS • ${atomicSwap.transferNameTo}`
    ];
  }

  // Regular transactions
  const pills = [];

  for (const [outputIdx, output] of tx.outputs.entries()) {
    const { covenant } = output;
    const value = output.value / 1e6;
    const name = metadata.outputs[outputIdx].name || 'unknown name!';

    switch (covenant.action) {
      // Simple HNS transfer, no name
      case 'NONE':
        // hide change outputs
        if (output.path?.branch !== 1) {
          const addr = output.address.slice(0, 6) + '...' + output.address.slice(-6);
          pills.push(`SEND • ${value} HNS • ${addr}`);
        }
        break;

      // Display bid and blind separately
      case 'BID':
        const bid = metadata.outputs[outputIdx].bid / 1e6;
        const blind = value - bid;
        pills.push(`BID • ${bid} (+${blind} blind) HNS • ${name}/`);
        break;

      // Show value
      case 'REVEAL':
      case 'REDEEM':
        pills.push(`${covenant.action} • ${value} HNS • ${name}/`);
        break;

      // Name only
      default:
        pills.push(`${covenant.action} • ${name}/`);
        break;
    }
  }

  return pills;
}


/**
 * Identify atomic swap transactions
 * @param {object} tx JSON object of a tx
 * @param {import('../../background/wallet/service').Metadata} metadata
 */
function parseAtomicSwap(tx, metadata) {
  // Atomic swap (HIP-4) hints:
  // - in0.witness[0] ends with 84
  // - last output value = price
  // - out0 = FINALIZE

  const out0 = tx.outputs?.[0];
  if (!out0) return null;
  if (out0.covenant?.action !== 'FINALIZE') return null;

  const in0 = tx.inputs?.[0];
  if (!in0) return null;

  const {witness} = in0;
  if (!witness || !Array.isArray(witness)) return null;

  // sig exists
  if (witness[0]) {
    // but doesn't end with 84 (SINGLEREVERSE | ANYONECANPAY)
    if (!witness[0].endsWith('84')) return null;
  } else {
    // no sig yet, we check to-be-used sighashType
    if (metadata?.inputs?.[0]?.sighashType !== 132) return null;
  }

  // We are now sure it's an atomic swap
  const value = tx.outputs[tx.outputs.length-1].value / 1e6;
  const signed = !!witness[0];
  const transferNameTo = out0.address;
  const receiving = !!out0.path;

  return {
    value,
    signed,
    transferNameTo,
    receiving,
  }
}

/**
 * Returns the index of the first own multisig input
 * If none are own, falls back to first multisig input
 * @param {import('../../background/wallet/service').SignerData} signerData
 * @returns {number} index of first own multisig input
 */
function getOwnMultisigInputIndex(signerData) {
  let firstNonNullIdx = null;

  // For every input,
  for (const [inputIdx, inputSigners] of signerData.entries()) {

    if (!inputSigners) continue;

    if (firstNonNullIdx === null) {
      firstNonNullIdx = inputIdx;
    }

    // If every signer has an account key,
    // this is our multisig input.
    if (inputSigners.every(signer => !!signer.accountKey)) {
      return inputIdx;
    }
  }

  // Fallback to first multisig index (not own)
  return firstNonNullIdx;
}
