import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from "classnames";
import BackArrowIcon from "../../assets/images/arrow-back-blue.svg";
import "./name-claim-modal.scss";
import Modal from "../Modal";
import {ensureDot} from "../../utils/nameHelpers";
import {displayBalance} from "../../utils/balances";
import {clientStub as wClientStub} from "../../background/wallet/client";
import {constants, dnssec, wire, Ownership, util} from 'bns';
import blake2b from "bcrypto/lib/blake2b";
import fs from "fs";
const { dialog } = require("electron").remote;
import {clientStub as nClientStub} from "../../background/node/client";
import Alert from "../Alert";
import CopyButton from "../CopyButton";
import {HeaderItem, HeaderRow, Table, TableItem, TableRow} from "../Table";
import {MiniModal} from "../Modal/MiniModal";
import { shell } from 'electron';

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
    name: PropTypes.string,
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
    success: null,
  };

  async componentWillMount() {
    if (this.props.name) {
      this.getClaim(this.props.name, null);
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
        url: '',
      });
      return;
    }

    if (url && claim.target !== url) {
      this.setState({
        name: '',
        error: `"${name}" is reserved, but belongs to "${claim.target}", not "${url}"`,
        claim: {reward: '', fee: '', txt: ''},
        proof: null,
        keys: [],
        txt: '',
        url: '',
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

    let chosenKey = null;
    for (const key of this.state.keys) {
      if (key.filename === fileName) {
        chosenKey = key;
        break;
      }
    }
    if (!chosenKey) {
      this.setState({
        error: `Can not sign with key: ${fileName}`,
      });
      return;
    }

    let sig
    try {
      sig = dnssec.sign(chosenKey, privateKey, [rr], lifespan);
    } catch (e) {
      this.setState({
        error: `Can not sign with key: ${e.message}`,
      });
      return;
    }

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

  insertRecords = async (pasteRRs) => {
    if (!this.state.proof) {
      return;
    }

    const chunk = pasteRRs;
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
  };

  sendRawClaim = async (blob) => {
    this.setState({error: ''});

    // Verify first to be nice
    let proof;

    try {
      if (!blob) {
        throw new Error('Not a valid base64 string.');
      }

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
  };

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
      keys,
    } = this.state;

    const {
      onClose,
    } = this.props;

    if (this.state.success) {
      return (
        <div className="name-claim__container">
          <div className="name-claim__header">
            <div className="name-claim__title">Reserved Name Claim</div>
          </div>
          <div className="name-claim__content">
            <ReservedNameInfoCard
              url={url}
              name={name}
              fee={claim.fee}
              reward={claim.reward}
            />
            <div className="name-claim__content__success">
              <div className="name-claim__content__success__icon" />
              <div className="name-claim__content__success__title">
                You have submitted your name claim successfully!
              </div>
              <div className="name-claim__content__success__content">
                It may take up to 15 minutes to be confirmed in the coinbase transaction of a block.
                Your claim ID is not like a transaction ID and will not be found by most block explorers.
                It may still be useful in debugging from the logs.
                <hr />
                <div className="name-claim__content__success__claim-id">
                  Your claim ID: <span className='mono'>{this.state.success}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="name-claim__footer">
            <button
              className="name-claim__cta"
              onClick={onClose}
            >
              Finish
            </button>
          </div>
        </div>
      )
    }

    switch (stepType) {
      case STEP.CLAIM:
        return (
          <ClaimOption
            url={url}
            name={name}
            fee={claim.fee}
            reward={claim.reward}
            txt={claim.txt}
            keys={keys}
            error={error}
            claimType={this.state.claimType}
            onClose={onClose}
            onBack={() => this.setState({ stepType: STEP.CHOOSE_OPTIONS, error: '' })}
            submitClaim={this.submitClaim}
            localSign={this.localSign}
            insertRecords={this.insertRecords}
            sendRawClaim={this.sendRawClaim}
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
            onBack={() => this.setState({ stepType: STEP.CHECK_NAME })}
          />
        );
      case STEP.CHECK_NAME:
      default:
        return (
          <CheckName
            url={url}
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
    onBack: PropTypes.func.isRequired,
    submitClaim: PropTypes.func.isRequired,
    localSign: PropTypes.func.isRequired,
    insertRecords: PropTypes.func.isRequired,
    sendRawClaim: PropTypes.func.isRequired,
    claimType: PropTypes.string,
    url: PropTypes.string,
    reward: PropTypes.string,
    fee: PropTypes.string,
    txt: PropTypes.string,
    keys: PropTypes.array,
    error: PropTypes.string,
  };

  state = {
    pasteRRs: '',
    blob: '',
  };

  render() {
    const {
      onClose,
      onBack,
      url,
      name,
      reward,
      fee,
      error,
    } = this.props;

    return (
      <div className="name-claim__container">
        <div className="name-claim__header">
          <div
            className="name-claim__back-btn"
            style={{
              backgroundImage: `url(${BackArrowIcon})`,
            }}
            onClick={onBack}
          />
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
        { !!error && <Alert type="error">{error}</Alert> }
        <div className="name-claim__footer">
          { this.renderCTA() }
        </div>
      </div>
    );
  }

  renderCTA () {
    const {
      submitClaim,
      localSign,
      insertRecords,
      sendRawClaim,
    } = this.props;

    const {
      pasteRRs,
      blob,
    } = this.state;

    switch (this.props.claimType) {
      case CLAIM_TYPE.TXT:
        return (
          <button
            className="name-claim__cta"
            onClick={submitClaim}
          >
            Check DNS
          </button>
        );
      case CLAIM_TYPE.DNSSEC:
        return (
          <button
            className="name-claim__cta"
            onClick={localSign}
          >
            Sign with local key
          </button>
        );
      case CLAIM_TYPE.RRSIG:
        return (
          <button
            className="name-claim__cta"
            onClick={() => insertRecords(pasteRRs)}
            disabled={!pasteRRs}
          >
            Insert records into claim
          </button>
        );
      case CLAIM_TYPE.BASE64:
        return (
          <button
            className="name-claim__cta"
            onClick={() => sendRawClaim(blob)}
            disabled={!blob}
          >
            Send raw claim
          </button>
        );
      default:
        return null;
    }
  }

  renderContent() {
    switch (this.props.claimType) {
      case CLAIM_TYPE.TXT:
        return this.renderTXT();
      case CLAIM_TYPE.DNSSEC:
        return this.renderDNSSEC();
      case CLAIM_TYPE.RRSIG:
        return this.renderRRSIG();
      case CLAIM_TYPE.BASE64:
        return this.renderBASE64();
      default:
        return null;
    }
  }

  renderBASE64() {
    const {
      txt,
      url,
    } = this.props;

    const fakeproof = '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';

    return (
      <div className="name-claim__claim-content">
        <div className="name-claim__claim-content__title">
          Using <a onClick={() => shell.openExternal('https://github.com/pinheadmz/bns/tree/pkcs11')}>bns-prove</a> on
          a machine with DNS lookup capabilities and access to your DNSSEC keys,
          sign the string below to generate a base64 proof and paste the entire output below:
        </div>
        <Table className="name-claim__claim-content__txt-table">
          <HeaderRow>
            <HeaderItem width="0rem"></HeaderItem>
            <HeaderItem width="0rem"></HeaderItem>
            <HeaderItem>text string</HeaderItem>
          </HeaderRow>
          <TableRow>
            <TableItem width="0rem"></TableItem>
            <TableItem width="0rem"></TableItem>
            <TableItem className="wrap">
              {txt}
              <CopyButton content={txt} />
            </TableItem>
          </TableRow>
        </Table>
        <textarea
          className="name-claim__claim-content__textarea"
          value={this.state.blob}
          onChange={(e) => this.setState({
            blob: e.target.value,
          })}
          placeholder={fakeproof}
        />
      </div>
    );
  }

  renderRRSIG() {
    const {
      txt,
      url,
    } = this.props;

    const faketxt = (!!url && !!txt)
        ? `${url} 300 IN TXT "${txt}"`
        : ''; 
    const fakesig = (!!url && !!txt)
        ? `${url} 300 IN RRSIG TXT 13 2 300 20210603180907 20210601160907 34505 ${url} f6x5CBP1ySenfPodSGSPNPCdzLzhlXK8shtpfzcEmCs09amCSqCIwniq eEIR1EYCuijP4OCKFyEnEhfEk+l81A==`
        : '';
    const fakeRRs = faketxt + '\n\n' + fakesig;

    return (
      <div className="name-claim__claim-content">
        <div className="name-claim__claim-content__title">
          Using your own software
          like <a onClick={() => shell.openExternal('https://linux.die.net/man/8/dnssec-signzone')}>BIND9 dnssec-signzone</a>,
          create a TXT record using the string below, add it to a zone file and sign it. Then paste both TXT and RRSIG records
          in DNS zone file format below to continue.
        </div>
        <Table className="name-claim__claim-content__txt-table">
          <HeaderRow>
            <HeaderItem>Type</HeaderItem>
            <HeaderItem>Host/Name</HeaderItem>
            <HeaderItem>Value</HeaderItem>
          </HeaderRow>
          <TableRow>
            <TableItem>TXT</TableItem>
            <TableItem>{url}</TableItem>
            <TableItem className="wrap">
              {txt}
              <CopyButton content={txt} />
            </TableItem>
          </TableRow>
        </Table>
        <textarea
          className="name-claim__claim-content__textarea"
          placeholder={fakeRRs}
          value={this.state.pasteRRs}
          onChange={(e) => this.setState({
            pasteRRs: e.target.value,
          })}
        />
      </div>
    );
  }

  renderTXT() {
    const {
      txt,
      url,
    } = this.props;

    return (
      <div className="name-claim__claim-content">
        <div className="name-claim__claim-content__title">
          Create a TXT record with the below string in your zone using your domain name service provider, then click "Check DNS".
        </div>
        <Table className="name-claim__claim-content__txt-table">
          <HeaderRow>
            <HeaderItem>Type</HeaderItem>
            <HeaderItem>Host/Name</HeaderItem>
            <HeaderItem>Value</HeaderItem>
          </HeaderRow>
          <TableRow>
            <TableItem>TXT</TableItem>
            <TableItem>{url}</TableItem>
            <TableItem className="wrap">
              {txt}
              <CopyButton content={txt} />
            </TableItem>
          </TableRow>
        </Table>
      </div>
    );
  }

  renderDNSSEC() {
    const rows = [];
    for (const key of this.props.keys) {
      const filename = key.filename;
      const json = key.getJSON();

      rows.push(
        <TableRow>
          <TableItem width="3rem">{json.data.keyTag}</TableItem>
          <TableItem width="8rem">{json.data.algName}</TableItem>
          <TableItem>{filename}</TableItem>
        </TableRow>
      );
    }

    return (
      <div className="name-claim__claim-content">
        <div className="name-claim__claim-content__title">
          Select your DNSSEC zone-signing private key to automatically sign and broadcast the claim proof.
        </div>
        <Table className="name-claim__claim-content__txt-table">
          <HeaderRow>
            <HeaderItem width="3rem">Key tag</HeaderItem>
            <HeaderItem width="8rem">Key algorithm</HeaderItem>
            <HeaderItem>Filename</HeaderItem>
          </HeaderRow>
          {rows}
        </Table>
      </div>
    );
  }
}

class ChooseOptions extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    changeClaimType: PropTypes.func.isRequired,
    url: PropTypes.string,
    reward: PropTypes.string,
    fee: PropTypes.string,
    error: PropTypes.string,
  };

  render() {
    const {
      onClose,
      onBack,
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
          <div
            className="name-claim__back-btn"
            style={{
              backgroundImage: `url(${BackArrowIcon})`,
            }}
            onClick={onBack}
          />
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
              How is your domain's DNSSEC managed?
            </div>
            <div className="name-claim__choose-options__options">
              { this.renderOption('Online DNS service', CLAIM_TYPE.TXT)}
              { this.renderOption('Local DNSSEC key', CLAIM_TYPE.DNSSEC)}
              { this.renderOption('Offline DNSSEC key', CLAIM_TYPE.RRSIG)}
              { this.renderOption('HSM / PKCS#11', CLAIM_TYPE.BASE64)}
            </div>
          </div>
        </div>
        { this.renderDescription() }
        <div className="name-claim__footer">
          <button
            className="name-claim__cta"
            disabled={!this.props.claimType}
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
            <div><b>Online DNS service: add TXT record to legacy DNS</b></div>
            Create a TXT record in your zone using your domain name service provider. Your domain and its top-level domain must have strong DNSSEC enabled.
          </div>
        );
      case CLAIM_TYPE.RRSIG:
        return (
          <div className="name-claim__option-description">
            <div><b>Offline DNSSEC key: sign offline, paste TXT + RRSIG</b></div>
            Using your own software
            like <a onClick={() => shell.openExternal('https://linux.die.net/man/8/dnssec-signzone')}>BIND9 dnssec-signzone</a>,
            create and sign a zone file with a TXT record and RRSIG.
          </div>
        );
      case CLAIM_TYPE.DNSSEC:
        return (
          <div className="name-claim__option-description">
            <div><b>Local DNSSEC key: sign using private key on this computer</b></div>
            If your DNSSEC zone-signing private key is available on this machine you can select it to automatically sign and broadcast the claim proof.
          </div>
        );
      case CLAIM_TYPE.BASE64:
        return (
          <div className="name-claim__option-description">
            <div><b>HSM / PKCS#11: sign with secure device, then paste base64 claim</b></div>
            Using <a onClick={() => shell.openExternal('https://github.com/pinheadmz/bns/tree/pkcs11')}>bns-prove</a> on
            a machine with DNS lookup capabilities and access to your DNSSEC keys or PKCS11-compatabile HSM, generate a complete base64 proof.
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
