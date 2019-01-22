import React, { Component } from 'react';
import { shell } from 'electron'
import ProofModal from '../../components/ProofModal/index';
import './get-coins.scss';

// eslint-disable-next-line react/prop-types
const Step = ({ number, title, paragraph }) => (
  <div className="get-coins__step">
    <div className="get-coins__step-number">{number}</div>
    <div className="get-coins__step-content">
      <div className="get-coins__step-title">{title}</div>
      <div className="get-coins__step-paragraph">{paragraph}</div>
    </div>
  </div>
);

export default class GetCoins extends Component {
  state = {
    isShowingGitHubModal: false,
    isShowingPGPModal: false
  };

  closeModal = () => this.setState({ isShowingGitHubModal: false, isShowingPGPModal: false });
  openGitHubModal = () => this.setState({ isShowingGitHubModal: true, isShowingPGPModal: false });
  openPGPModal = () => this.setState({ isShowingGitHubModal: false, isShowingPGPModal: true });

  renderModal() {
    const { isShowingGitHubModal, isShowingPGPModal } = this.state;

    if (isShowingGitHubModal) {
      return (
        <ProofModal
          type="SSH"
          onSubmit={() => console.log('submit github proof')}
          onClose={this.closeModal}
        />
      );
    }

    if (isShowingPGPModal) {
      return (
        <ProofModal
          type="PGP"
          onSubmit={() => console.log('submit pgp proof')}
          onClose={this.closeModal}
        />
      );
    }
  }

  render() {
    return (
      <div className="get-coins">
        <div className="get-coins__left">
          <h1>GooSig: Handshake Airdrop to ~175,000 Open Source Developers with SSH or PGP Keys (Encrypted)</h1>
          <h2>How it works</h2>
          <p>
            Handshake Network’s decentralized airdrop is gifting coins to the top ~175,000 developers on GitHub with valid SSH and/or PGP keys.
          </p>
          <p>
            If you had 15 or more followers on GitHub during the week of 2018-08-27, your GitHub SSH & PGP keys are included in the Handshake network’s merkle tree. Likewise, roughly 30,000 keys from the PGP WOT Strongset have also been included in the tree. You’ll receive 2500 HNS for each proof.
          </p>
          <p>
            <div className="get-coins__link" onClick={() => shell.openExternal('https://github.com')}>
              See full details on GitHub
            </div>
            
          </p>
          <h2>Privacy (GooSig)</h2>
          <p>
            To preserve privacy for the time being, a 32 byte nonce has been encrypted to your PGP
            or SSH key. No one will be able to identify your key fingerprint in the tree published
            above until you decide to reveal it on-chain by decrypting the nonce, creating the
            proof, and publishing it.
          </p>

          <p>
            GooSig was created for the Handshake Project to address a very specific problem: an
            airdrop to Github users' RSA keys allows Github users to be identified on-chain. In
            order to anonymize who is receiving coins from the airdrop, cryptographic trickery is
            required: GooSig allows the creation of signatures originating from RSA private keys
            without revealing the RSA public key.
          </p>

          <p>
            GooSig makes use of (G)roups of Unkn(o)wn (O)rder, and implements a cryptographic
            protocol devised by Dan Boneh and Riad S. Wahby at the Stanford Center for Blockchain
            Research. It was originally ported from the python reference implementation to
            javascript, but has since been implemented in C as well.
          </p>
          <p>
            <div className="get-coins__link" onClick={() => shell.openExternal('https://github.com')}>  
              See full details on GitHub
            </div>
          </p>
        </div>
        <div className="get-coins__right">
          <div className="get-coins__panel">
            <div className="get-coins__panel__title">Claim your coins with a proof</div>
            <div className="get-coins__panel__offer">
              <div>+2500 HNS</div>
              <div>GitHub Developers</div>
              <div>15 or more followers</div>
              <div>SSH key</div>
              <button onClick={this.openGitHubModal}>Submit SSH Proof</button>
            </div>
            <div className="get-coins__panel__offer">
              <div>+2500 HNS</div>
              <div>PGP Web of Trust</div>
              <div>PGP key</div>
              <div>Member of strong set</div>
              <button onClick={this.openPGPModal}>Submit PGP Proof</button>
            </div>
          </div>
        </div>
        {this.renderModal()}
      </div>
    );
  }
}
