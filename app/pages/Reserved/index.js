import fs from "fs";
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { clientStub as nClientStub } from "../../background/node/client";
import { clientStub as wClientStub } from '../../background/wallet/client';
import { displayBalance, toBaseUnits, toDisplayUnits } from '../../utils/balances';
import CopyButton from '../../components/CopyButton';
import Tooltipable from '../../components/Tooltipable';
import { MiniModal } from '../../components/Modal/MiniModal';
const { dialog } = require("electron").remote;

import blake2b from 'bcrypto/lib/blake2b';
import {constants, dnssec, wire, Ownership, util} from 'bns';
import './reserved.scss';

const {Proof} = Ownership;

const {
  keyFlags,
  classes,
  types
} = constants;

const {
  Record,
  TXTRecord
} = wire;

const wallet = wClientStub(() => require('electron').ipcRenderer);
const node = nClientStub(() => require('electron').ipcRenderer);

class Reserved extends Component {
  state = {
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
  }

  async componentWillMount() {
    if (this.state.name)
      this.getClaim(this.state.name, null);
  }

  ensureDot(string) {
    if (string[string.length - 1] !== '.')
      return string + '.';

    return string;
  }

  handleInputValueChange = async (e) => {
    let { value } = e.target;
    value = value.toLowerCase();
    this.setState({
      url: value
    })
  };

  searchReserved = async () => {
    const url = this.ensureDot(this.state.url);
    const labels = url.split('.');
    const name = labels[0];

    return this.getClaim(name, url);
  }

  getClaim = async (name, url) => {
    let claim
    try {
      claim = await wallet.createClaim(name);
    } catch(e) {
      this.setState({
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
    })

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
  }

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
  }

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
    const fakesig =
      this.state.url && this.state.txt ?
        `${this.state.url} 300 IN RRSIG TXT 13 2 300 20210603180907 20210601160907 34505 ${this.state.url} f6x5CBP1ySenfPodSGSPNPCdzLzhlXK8shtpfzcEmCs09amCSqCIwniq eEIR1EYCuijP4OCKFyEnEhfEk+l81A==` :
        '';
    const fakeRRs = this.state.txt + '\n' + fakesig;

    if (this.state.success) {
      return (
        <MiniModal
          title="Reserved name claim broadcast successfully!"
          onClose={() => {this.setState({success: null})}}
          wide={true}
        >
          It may take up to 15 minutes to be confirmed in the coinbase transaction of a block.
          Your claim ID is not like a transaction ID and will not be found by most block explorers.
          It may still be useful in debugging from the logs.
          <hr />
          Your claim ID: <span className='mono'>{this.state.success}</span>
        </MiniModal>
      );
    }

    return (
      <div>
        <div className="reserved__top">
          Search for reserved URL:&nbsp;
          <input
            type="text"
            value={this.state.url}
            onChange={this.handleInputValueChange}
            onKeyDown={e => e.key === 'Enter' && this.searchReserved()}
            placeholder="icann.org"
          />
          <h2>Claim reserved name: {this.state.name}</h2>
        </div>
        <div className="reserved__error">
          {this.state.error}
        </div>
        <div>
          <table className="reserved__table">
            <tr><td>Reward</td><td>{this.state.claim.reward}</td><td></td></tr>
            <tr><td>Fee</td><td>{this.state.claim.fee}</td><td></td></tr>
            <tr><td>TXT</td><td className="wrap">{this.state.claim.txt}</td><td><CopyButton content={this.state.claim.txt} /></td></tr>
          </table>
        </div>
        <div>
          <h2>Sign and broadcast this claim:</h2>

          <div className="reserved__method">
            Method 1 (online): Paste above TXT into legacy DNS
            <Tooltipable
              tooltipContent="Create a TXT record with the above string in your zone using your domain name service provider. Your domain and its top-level domain must have strong DNSSEC enabled.">
              <div className="reserved__info-icon" />
            </Tooltipable>
            <button
              className="reserved__button"
              onClick={this.submitClaim}
            >
              Submit claim from legacy DNS
            </button>
          </div>
          <hr />

          <div className="reserved__method">
            Method 2 (offline): Sign with local DNSSEC key
            <Tooltipable
              tooltipContent="If your DNSSEC zone-signing private key is available on this machine you can select it to automatically sign and broadcast the claim proof.">
              <div className="reserved__info-icon" />
            </Tooltipable>
            <button
              className="reserved__button"
              onClick={this.localSign}
            >
              Sign with local key
            </button>
          </div>
          <div>
            {this.displayKeys()}
          </div>
          <hr />

          <div className="reserved__method">
            Method 3 (offline - airgapped): Paste TXT + RRSIG
            <Tooltipable
              tooltipContent="Using your own software like BIND9 dnssec-signzone, create and sign a zone file with a TXT record (containing the string above) and RRSIG. Paste both records here in DNS zone file format.">
              <div className="reserved__info-icon" />
            </Tooltipable>
            <button
              className="reserved__button"
              onClick={this.insertRecords}
            >
              Insert records into claim
            </button>
          </div>
          <div>
            <textarea
              className="reserved__pasteRRs"
              placeholder={fakeRRs}
              value={this.pasteRRs}
              onChange={(e) => {this.setState({pasteRRs: e.target.value})}}
            />
          </div>
          <hr />

          <div className="reserved__method">
            Method 4 (offline - airgapped + DNS): Paste entire base64 claim
            <Tooltipable
              tooltipContent="Using bns-prove on a machine with DNS lookup capabilities and access to your DNSSEC keys or HSM, generate a base64 proof and paste the entire string here.">
              <div className="reserved__info-icon" />
            </Tooltipable>
            <button
              className="reserved__button"
              onClick={this.sendRawClaim}
            >
              Send raw claim
            </button>
          </div>
          <div>
            <textarea
              className="reserved__pasteRRs"
              onChange={(e) => {this.setState({blob: e.target.value})}}
            />
          </div>
          <hr />

        </div>
      </div>
    );
  }
}

export default withRouter(
  connect(
    ((state, ownProps) => ({
      name: ownProps.match.params.name,
    })),
    (dispatch, ownProps) => ({
    }),
  )(Reserved),
);