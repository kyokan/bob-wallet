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
    signerData: PropTypes.array,
    metadata: PropTypes.object,
  }

  static contextType = I18nContext;

  render() {
    const { t } = this.context;
    const { tx } = this.props;

    if (!tx) return null;

    return (
      <div className="tx-viewer">
        {this.renderInfo()}

        <div className="tx-viewer__container">
          {/* Inputs */}
          <div>
            <h4 className="tx-viewer__heading">{t('inputs')}</h4>
            {tx.inputs.map((input, inputIdx) => this.renderInput(input, inputIdx))}
          </div>

          {/* Outputs */}
          <div>
            <h4 className="tx-viewer__heading">{t('outputs')}</h4>
            {tx.outputs.map((output, outputIdx) => this.renderOutput(output, outputIdx))}
          </div>
        </div>
      </div>
    )
  }

  renderInfo = () => {
    const { t } = this.context;
    const { tx } = this.props;

    return (
      <div className="tx-viewer__info">
        <div>
          <div className="label">{t('transactionHash')}:</div>
          <div className="value">{tx.hash}</div>
        </div>
        <div>
          <div className="label">{t('fee')}:</div>
          <div className="value">{tx.fee / 1e6} HNS ({tx.rate / 1e6} HNS/kB)</div>
        </div>
        <div>
          <div className="label">{t('locktime')}:</div>
          <div className="value">{tx.locktime}</div>
        </div>
      </div>
    );
  }

  renderInput = (input, inputIdx) => {
    const { signerData, accountKey, walletKeysNames, walletId } = this.props;

    return (
      <div key={inputIdx} className="tx-viewer__card">
        <div className="tx-viewer__card__desc">
          <span>({input.prevout.hash.slice(0, -6)}</span>
          <span>{input.prevout.hash.slice(-6)}, {input.prevout.index})</span>
          <span>
            {input.coin ?
              `${input.coin.value / 1e6} HNS`
              : 'Unknown HNS'
            }
          </span>
        </div>
        {signerData && signerData[inputIdx] && (
          <div className="tx-viewer__card__sigs">
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
          <span>
            {output.path && `${t('own')} `}
            {output.address.slice(0, -6)}
          </span>
          <span>{output.address.slice(-6)}</span>
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
