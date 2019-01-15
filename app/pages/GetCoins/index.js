import React, { Component } from 'react';
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
          <h1>Get Handshake coins</h1>
          <h2>How it works</h2>
          <p>
            Handshake Network’s decentralized airdrop is gifting coins to the top ~175,000
            developers on GitHub with valid SSH and/or PGP keys.
          </p>
          <p>
            If you had 15 or more followers on GitHub during the week of 2018-08-27, your GitHub SSH
            & PGP keys are included in the Handshake network’s merkle tree. Likewise, roughly 30,000
            keys from the PGP WOT Strongset have also been included in the tree.
          </p>
          <p>You’ll receive 2500 HNS for each proof.</p>
          <p>
            <a href="https://github.com" target="_blank">
              See full details on GitHub
            </a>
          </p>
          <h2>Redemption instructions</h2>
          <p>
            Check your SSH and/or PGP keys for 2500-5000 HNS coins. If you are uncomfortable having
            third party software access your PGP and/or SSH keys, you are always able to generate
            this proof on an air-gapped machine.
          </p>
          <Step
            number={1}
            title="Generate a Handshake Address"
            paragraph="Bird bird bird bird bird bird human why take bird out i could have eaten that stretch. Damn that dog meow, and what a cat-ass-trophy! and play riveting piece on synthesizer keyboard or i show my fluffy belly but it's a trap!"
          />
          <Step
            number={2}
            title="Copy and Paste Your SSH Proof Here"
            paragraph="Bring your owner a dead bird cuddle no cuddle cuddle love scratch scratch or stand with legs in litter box, but poop outside lounge in doorway."
          />
          <Step
            number={3}
            title="Generate a Handshake Address"
            paragraph="Intently stare at the same spot hiding behind the couch until lured out by a feathery toy make meme, make cute face for play riveting piece on synthesizer keyboard dismember a mouse and then regurgitate parts of it on the family room floor so sleep on keyboard."
          />
          <p>
            There are a few gotchas: Handshake does not allow standard PGP signatures on the
            consensus layer. This is done for simplicity and safety. This means that a regular call
            to $ gpg --sign will not work for Handshake airdrop proofs. As far as SSH keys go,
            people typically do not sign arbitrary messages with them.
          </p>
          <p>
            <a href="https://github.com" target="_blank">
              See full instructions on GitHub
            </a>
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
            <a href="https://github.com" target="_blank">
              See full details on GitHub
            </a>
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
