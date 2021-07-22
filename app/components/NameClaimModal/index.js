import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from "classnames";
import "./name-claim-modal.scss";
import Modal from "../Modal";
import {ensureDot} from "../../utils/nameHelpers";
import {displayBalance} from "../../utils/balances";
import {clientStub as wClientStub} from "../../background/wallet/client";
import {constants, dnssec, wire, Ownership, util} from 'bns';
import blake2b from "bcrypto/lib/blake2b";
import fs from "fs";
import {clientStub as nClientStub} from "../../background/node/client";
import Alert from "../Alert";
import CopyButton from "../CopyButton";

const {Proof} = Ownership;
const wallet = wClientStub(() => require('electron').ipcRenderer);
const node = nClientStub(() => require('electron').ipcRenderer);
const {
  keyFlags,
  classes,
  types
} = constants;

const {
  Record,
  TXTRecord
} = wire;

const STEP = {
  CHECK_NAME: 'CHECK_NAME',
  CHOOSE_OPTIONS: 'CHOOSE_OPTIONS',
  CLAIM: 'CLAIM',
};

const CLAIM_TYPE = {
  TXT: 'TXT',
  DNSSEC: 'DNSSEC',
  RRSIG: 'RRSIG',
  BASE64: 'BASE64',
};

@connect(
  state => ({

  }),
)
export default class NameClaimModal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
  };

  state = {
    stepType: STEP.CHECK_NAME,
    claimType: null,
    name: this.props.name,
    url: '',
    error: '',
    claim: {reward: '', fee: '', txt: ''},
    proof: null,
    keys: [],
    txt: '',
    pasteRRs: '',
    blob: '',
    success: null,
  };

  async componentWillMount() {
    if (this.state.name) {
      this.getClaim(this.state.name, null);
    }
  }

  changeClaimType = (claimType) => {
    this.setState({ claimType });
  };

  handleInputValueChange = async (e) => {
    let { value } = e.target;
    value = value.toLowerCase();
    this.setState({
      url: value
    })
  };

  searchReserved = async (rawURL) => {
    const url = ensureDot(rawURL);
    const labels = url.split('.');
    const name = labels[0];

    return this.getClaim(name, url);
  };

  getClaim = async (name, url) => {
    let claim;
    try {
      claim = await wallet.createClaim(name);
    } catch(e) {
      this.setState({
        name: '',
        error: e.message,
        claim: {reward: '', fee: '', txt: ''},
        proof: null,
        keys: [],
        txt: '',
      });
      return;
    }

    if (url && claim.target !== url) {
      this.setState({
        error: `"${name}" is reserved, but belongs to "${claim.target}", not "${url}"`,
        claim: {reward: '', fee: '', txt: ''},
        proof: null,
        keys: [],
        txt: '',
      });
      return;
    }

    const reward = displayBalance(claim.value, true);
    let fee = displayBalance(claim.fee, true);
    while (reward.length > fee.length)
      fee = ' ' + fee;
    const txt = claim.txt;

    this.setState({
      name,
      url: claim.target,
      claim: {reward, fee, txt},
      error: '',
    });

    const txtRecord = this.getTXT();
    this.setState({
      txt: txtRecord.toString(),
    });

    // Check DNSSEC for this name
    let json;
    try {
      json = await node.getDNSSECProof(claim.target);
    } catch(e) {
      // If we catch an error here, the user should be alerted.
      // They may need to set up DNSSEC for their own name,
      // or their parent zone does.
      this.setState({
        error: `"${name}" can not be claimed at this time: ${e.message}`,
        proof: null,
        keys: [],
        txt: '',
      });
      return;
    }

    this.setState({
      proof: Proof.fromJSON(json)
    });

    this.getKeys();
  };

  submitClaim = async () => {
    let json;
    try {
      json = await wallet.sendClaim(this.state.name);
    } catch(e) {
      this.setState({
        error: `Error sending claim: ${e.message}`,
      });
      return;
    }

    const proof = Proof.fromJSON(json);
    const data = proof.encode();
    const hash = blake2b.digest(data).toString('hex');

    this.setState({success: hash});
  };

  getTXT() {
    const rr = new Record();
    const rd = new TXTRecord();

    rr.name = this.state.url;
    rr.type = types.TXT;
    rr.class = classes.IN;
    rr.ttl = 3600;
    rr.data = rd;

    rd.txt.push(this.state.claim.txt);

    return rr;
  }

  getKeys() {
    let keys = [];
    if (!this.state.proof)
      return keys;

    const proof = this.state.proof;
    const zone = proof.zones[proof.zones.length - 1];

    for (const key of zone.keys) {
      if (key.type !== types.DNSKEY)
        continue;

      const kd = key.data;

      if (!(kd.flags & keyFlags.ZONE))
        continue;

      if (kd.flags & keyFlags.SEP)
        continue;

      if (kd.flags & keyFlags.REVOKE)
        continue;

      key.filename = dnssec.filename(
        this.state.url,
        key.data.algorithm,
        key.data.keyTag()
      ) + '.private';
      keys.push(key);
    }

    this.setState({
      keys
    });
  }

  localSign = async () => {
    if (!this.state.keys.length || !this.state.proof)
      return;

    const filenames = [];
    for (let key of this.state.keys) {
      filenames.push(key.filename);
    }
    const list = filenames.join(', ');


    const filePaths = await dialog.showOpenDialog({
      title: `Open DNSSEC private key file: ${list}`,
      message: `Open DNSSEC private key file: ${list}`,
      properties: ["openFile"],
      filters: {
        name: "BIND Private Key",
        extensions: ["private"]
      }
    });

    if (!filePaths.filePaths.length)
      return;

    const filePath = filePaths.filePaths[0];

    let fileName = filePath.split('/');

    fileName = fileName[fileName.length - 1];

    let found = false;
    for (const acceptable of filenames) {
      if (fileName === acceptable) {
        found = true;
        break;
      }
    }
    if (!found) {
      this.setState({
        error: `Can not sign with key ${fileName}`,
      });
      return;
    }

    const keyFile = fs.readFileSync(filePath, 'utf-8');
    const [alg, privateKey] = dnssec.decodePrivate(keyFile);

    const rr = this.getTXT();
    const lifespan = 365 * 24 * 60 * 60;

    const sig = dnssec.sign(this.state.keys[0], privateKey, [rr], lifespan);

    const proof = this.state.proof;
    const zone = proof.zones[proof.zones.length - 1];
    zone.claim.push(rr);
    zone.claim.push(sig);

    let json;
    try {
      json = await node.sendRawClaim(proof.toBase64());
    } catch (e) {
      this.setState({
        error: `Error sending claim: ${e.message}`,
      });
      return;
    }

    this.setState({success: json});
  }

  insertRecords = async () => {
    if (!this.state.proof)
      return;

    const chunk = this.state.pasteRRs;
    let RRs;

    this.setState({error: ''});

    try {
      RRs = wire.fromZone(chunk);
    } catch (e) {
      this.setState({
        error: `Error processing records: ${e.message}`,
      });
      return;
    }

    if (RRs.length !== 2) {
      this.setState({
        error: 'Exactly two records expected (TXT & RRSIG)',
      });
      return;
    }

    const rr = RRs[0];
    const sig = RRs[1];

    if (rr.type !== types.TXT || sig.type !== types.RRSIG) {
      this.setState({
        error: 'Only single TXT and single RRSIG allowed.',
      });
      return;
    }

    const proof = this.state.proof;
    const zone = proof.zones[proof.zones.length - 1];

    // clear other TXT records
    zone.claim.length = 0;

    zone.claim.push(rr);
    zone.claim.push(sig);

    let json;
    try {
      this.verifyProof(proof);
      json = await node.sendRawClaim(proof.toBase64());
    } catch (e) {
      this.setState({
        error: `Error sending claim: ${e.message}`,
      });
      return;
    }

    this.setState({success: json});
  }

  sendRawClaim = async () => {
    this.setState({error: ''});

    const {blob} = this.state;

    // Verify first to be nice
    let proof;
    try {
      if (!blob)
        throw new Error('Not a valid base64 string.');

      const data = Buffer.from(blob, 'base64');
      proof = Proof.decode(data);
    } catch (e) {
      this.setState({
        error: `Error decoding base64: ${e.message}`,
      });
      return;
    }

    let json;
    try {
      this.verifyProof(proof);
      json = await node.sendRawClaim(blob);
    } catch (e) {
      this.setState({
        error: `Error sending claim: ${e.message}`,
      });
      return;
    }

    this.setState({success: json});
  }

  verifyProof(proof) {
    const o = new Ownership();

    if (!o.isSane(proof))
      throw new Error('Malformed DNSSEC proof.');

    if (!o.verifySignatures(proof))
      throw new Error('Invalid DNSSEC proof signatures.');

    if (!o.verifyTimes(proof, util.now()))
      throw new Error('Proof contains expired signature.');

    return true;
  }

  displayKeys() {
    const rows = [];
    for (let key of this.state.keys) {
      const filename = key.filename;
      key = key.getJSON()
      rows.push(
        <tr>
          <td>{key.data.keyTag}</td>
          <td>{key.data.keyType}</td>
          <td>{key.data.algName}</td>
          <td>{filename}</td>
        </tr>
      );
    }

    return (
      <div>
        &nbsp;&nbsp;DNSKEYs available for signing:
        <table className="reserved__keyList">
          <tr><td>Key tag</td><td>Key type</td><td>Key Algorithm</td><td>Filename</td></tr>
          {rows}
        </table>
      </div>
    );
  }

  render() {
    const {
      onClose,
    } = this.props;

    return (
      <Modal className="name-claim" onClose={onClose}>
        { this.renderContent() }
      </Modal>
    );
  }

  renderContent() {
    const {
      stepType,
      url,
      name,
      claim,
      error,
    } = this.state;

    const {
      onClose,
    } = this.props;

    switch (stepType) {
      case STEP.CLAIM:
        return (
          <ClaimOption
            url={url}
            name={name}
            fee={claim.fee}
            reward={claim.reward}
            txt={claim.txt}
            error={error}
            claimType={this.state.claimType}
            onClose={onClose}
          />
        );
      case STEP.CHOOSE_OPTIONS:
        return (
          <ChooseOptions
            url={url}
            name={name}
            fee={claim.fee}
            reward={claim.reward}
            error={error}
            claimType={this.state.claimType}
            changeClaimType={this.changeClaimType}
            onClose={onClose}
            onNext={() => this.setState({ stepType: STEP.CLAIM })}
          />
        );
      case STEP.CHECK_NAME:
      default:
        return (
          <CheckName
            url={(!error && !!claim.reward) ? url : ''}
            name={name}
            fee={claim.fee}
            reward={claim.reward}
            error={error}
            onClose={onClose}
            onUrlChange={this.handleInputValueChange}
            searchReserved={this.searchReserved}
            onNext={() => this.setState({ stepType: STEP.CHOOSE_OPTIONS })}
          />
        );
    }
  }
}

class ClaimOption extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    claimType: PropTypes.string,
    url: PropTypes.string,
    reward: PropTypes.string,
    fee: PropTypes.string,
    txt: PropTypes.string,
    error: PropTypes.string,
  };

  render() {
    const {
      onClose,
      url,
      name,
      reward,
      fee,
      error,
    } = this.props;

    return (
      <div className="name-claim__container">
        <div className="name-claim__header">
          <div className="name-claim__title">Reserved Name Claim</div>
          <div className="name-claim__close-btn" onClick={onClose}>✕</div>
        </div>
        <div className="name-claim__content">
          <ReservedNameInfoCard
            url={url}
            name={name}
            reward={reward}
            fee={fee}
          />
          { this.renderContent() }
        </div>
        <div className="name-claim__footer">
          <button
            className="name-claim__cta"
            disabled={!!error}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  renderContent() {
    const {
      txt,
    } = this.props;
    switch (this.props.claimType) {
      case CLAIM_TYPE.TXT:
        return (
          <div className="name-claim__claim-content">
            <div className="name-claim__claim-content__title">
              Create a TXT record with the below string in your zone using your domain name service provider, then click next
            </div>
            <table className="name-claim__claim-content__txt-table">
              <th>
                <td>Type</td>
                <td>Host</td>
                <td>Value</td>
              </th>
              <tr>
                <td>TXT</td>
                <td>@</td>
                <td className="wrap">
                  {txt}
                  <CopyButton content={txt} />
                </td>
              </tr>
            </table>
          </div>
        );
      case CLAIM_TYPE.DNSSEC:
      case CLAIM_TYPE.RRSIG:
      case CLAIM_TYPE.BASE64:
      default:
        return null;
    }
  }
}

class ChooseOptions extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    changeClaimType: PropTypes.func.isRequired,
    url: PropTypes.string,
    reward: PropTypes.string,
    fee: PropTypes.string,
    error: PropTypes.string,
  };

  state = {
    claimType: null,
  };

  render() {
    const {
      onClose,
      onNext,
      url,
      name,
      reward,
      fee,
      error,
    } = this.props;

    return (
      <div className="name-claim__container">
        <div className="name-claim__header">
          <div className="name-claim__title">Reserved Name Claim</div>
          <div className="name-claim__close-btn" onClick={onClose}>✕</div>
        </div>
        <div className="name-claim__content">
          <ReservedNameInfoCard
            url={url}
            name={name}
            reward={reward}
            fee={fee}
          />
          <div className="name-claim__choose-options">
            <div className="name-claim__choose-options__title">
              How would you like to claim your names?
            </div>
            <div className="name-claim__choose-options__options">
              { this.renderOption('TXT Record', CLAIM_TYPE.TXT)}
              { this.renderOption('DNSSEC Key', CLAIM_TYPE.DNSSEC)}
              { this.renderOption('RRSIG', CLAIM_TYPE.RRSIG)}
              { this.renderOption('OpenDNSSEC + HSM', CLAIM_TYPE.BASE64)}
            </div>
          </div>
        </div>
        { this.renderDescription() }
        <div className="name-claim__footer">
          <button
            className="name-claim__cta"
            disabled={!!error || !this.props.claimType}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  renderDescription() {
    switch (this.props.claimType) {
      case CLAIM_TYPE.TXT:
        return (
          <div className="name-claim__option-description">
            <div><b>Method 1 (online): Add TXT record to legacy DNS</b></div>
            Create a TXT record in your zone using your domain name service provider. Your domain and its top-level domain must have strong DNSSEC enabled.
          </div>
        );
      case CLAIM_TYPE.RRSIG:
        return (
          <div className="name-claim__option-description">
            <div><b>Method 3 (offline - airgapped): Paste TXT + RRSIG</b></div>
            Using your own software like BIND9 dnssec-signzone, create and sign a zone file with a TXT record (containing the string above) and RRSIG. Paste both records here in DNS zone file format.
          </div>
        );
      case CLAIM_TYPE.DNSSEC:
        return (
          <div className="name-claim__option-description">
            <div><b>Method 2 (offline): Sign with local DNSSEC key</b></div>
            If your DNSSEC zone-signing private key is available on this machine you can select it to automatically sign and broadcast the claim proof.
          </div>
        );
      case CLAIM_TYPE.BASE64:
        return (
          <div className="name-claim__option-description">
            <div><b>Method 4 (offline - airgapped + DNS): Paste entire base64 claim</b></div>
            Using bns-prove on a machine with DNS lookup capabilities and access to your DNSSEC keys or HSM, generate a base64 proof and paste the entire string here.
          </div>
        );
      default:
        return null;
    }

  }

  renderOption(label, type) {
    return (
      <div
        className={classNames("name-claim__choose-options__option", {
          "name-claim__choose-options__option--active": this.props.claimType === type,
        })}
        onClick={() => this.props.changeClaimType(type)}
      >
        {label}
      </div>
    )
  }
}

class CheckName extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onUrlChange: PropTypes.func.isRequired,
    url: PropTypes.string,
    reward: PropTypes.string,
    fee: PropTypes.string,
    error: PropTypes.string,
    searchReserved: PropTypes.func.isRequired,
  };

  state = {
    url: '',
  };

  handleChange = e => {
    this.setState({
      url: e.target.value,
    });
  };

  render() {
    const {
      onClose,
      searchReserved,
      url,
      name,
      reward,
      fee,
      error,
      onNext,
    } = this.props;

    return (
      <div className="name-claim__container">
        <div className="name-claim__header">
          <div className="name-claim__title">Reserved Name Claim</div>
          <div className="name-claim__close-btn" onClick={onClose}>✕</div>
        </div>
        <div className="name-claim__content">
          <div className="name-claim__name-input-group">
            <div className="name-claim__name-input-group__label">Enter your reserved domain</div>
            <input
              type="text"
              className="name-claim__name-input-group__input"
              value={this.state.url}
              onChange={this.handleChange}
              onBlur={() => searchReserved(this.state.url)}
              onKeyDown={e => e.key === 'Enter' && searchReserved(this.state.url)}
              placeholder="icann.org"
            />
          </div>
          {
            !!error && (
              <Alert type="error">
                {error}
              </Alert>
            )
          }
          <ReservedNameInfoCard
            url={url}
            name={name}
            reward={reward}
            fee={fee}
          />
        </div>
        <div className="name-claim__footer">
          <button
            className="name-claim__cta"
            disabled={!!error || !url}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>
    );
  }
}

class ReservedNameInfoCard extends Component {
  static propTypes = {
    name: PropTypes.string,
    url: PropTypes.string,
    reward: PropTypes.string,
    fee: PropTypes.string,
  };

  render() {
    const {name, url, reward, fee} = this.props;
    return (
      <div className="reserved-name-info">
        <div className="reserved-name-info__group">
          <div className="reserved-name-info__group__label">Name</div>
          <div className="reserved-name-info__group__value">{name || '-'}</div>
        </div>
        <div className="reserved-name-info__group">
          <div className="reserved-name-info__group__label">URL</div>
          <div className="reserved-name-info__group__value">{url || '-'}</div>
        </div>
        <div className="reserved-name-info__group">
          <div className="reserved-name-info__group__label">Reward</div>
          <div className="reserved-name-info__group__value">{reward || '-'}</div>
        </div>
        <div className="reserved-name-info__group">
          <div className="reserved-name-info__group__label">Fee</div>
          <div className="reserved-name-info__group__value">{fee || '-'}</div>
        </div>
      </div>
    )
  }
}
