import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { shell } from 'electron';
import ProofModal from '../../components/ProofModal/index';
import './get-coins.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

// eslint-disable-next-line react/prop-types
const Step = ({number, title, paragraph}) => (
  <div className="get-coins__step">
    <div className="get-coins__step-number">{number}</div>
    <div className="get-coins__step-content">
      <div className="get-coins__step-title">{title}</div>
      <div className="get-coins__step-paragraph">{paragraph}</div>
    </div>
  </div>
);

class GetCoins extends Component {
  state = {
    isShowingGitHubModal: false,
    isShowingPGPModal: false,
    isShowingFaucetModal: false,
  };

  componentDidMount() {
    analytics.screenView('Get Coins');
  }

  closeModal = () => this.setState({isShowingFaucetModal: false, isShowingGitHubModal: false, isShowingPGPModal: false});
  openGitHubModal = () => this.setState({isShowingFaucetModal: false, isShowingGitHubModal: true, isShowingPGPModal: false});
  openPGPModal = () => this.setState({isShowingFaucetModal: false, isShowingGitHubModal: false, isShowingPGPModal: true});
  openFaucetModal = () => this.setState({isShowingFaucetModal: true, isShowingGitHubModal: false, isShowingPGPModal: false});

  renderModal() {
    const {isShowingGitHubModal, isShowingPGPModal, isShowingFaucetModal} = this.state;

    if (isShowingGitHubModal) {
      return (
        <ProofModal
          type="SSH"
          onClose={this.closeModal}
        />
      );
    }

    if (isShowingPGPModal) {
      return (
        <ProofModal
          type="PGP"
          onClose={this.closeModal}
        />
      );
    }

    if (isShowingFaucetModal) {
      return (
        <ProofModal
          type="Faucet"
          onClose={this.closeModal}
        />
      );
    }
  }

  render() {
    return (
      <div className="get-coins">
        <div className="get-coins__left">
          <h1>Handshake Worldwide Airdrop</h1>
          <div className="get-coins__illustration">
            <div className="get-coins__illustration__col">
              <div className="get-coins__illustration__image-one" />
              <div className="get-coins__illustration__title">~175,000</div>
              <div className="get-coins__illustration__description">Open Source Devs</div>
            </div>
            <div className="get-coins__illustration__col">
              <div className="get-coins__illustration__image-two" />
              <div className="get-coins__illustration__title">4,662.598321 <span
                className="get-coins__illustration__subtitle">HNS</span></div>
              <div className="get-coins__illustration__description">Coins per SSH or PGP Key</div>
            </div>
            <div className="get-coins__illustration__col">
              <div className="get-coins__illustration__image-three" />
              <div className="get-coins__illustration__title">70%</div>
              <div className="get-coins__illustration__description">Coins in Genesis Block</div>
            </div>
          </div>
          <h2>How it works</h2>
          <p>
            Handshake Network’s decentralized airdrop is distributing coins to the top ~175,000 developers on GitHub
            with valid SSH and/or PGP keys. Every open source developer will receive 4,662.598321 HNS coins from the
            airdrop.
          </p>
          <p>
            If you had 15 or more followers on GitHub during the week of 2019-02-04, your GitHub SSH & PGP keys are
            included in the Handshake network’s merkle tree. Likewise, roughly 30,000 keys from the PGP WOT Strongset
            have also been included in the tree. You’ll receive 2500 HNS for each proof.
          </p>
          <p>
            This merkle tree is computed and its root is added to consensus rules of the Handshake blockchain, allowing
            the owner of a key to publish a signed merkle proof on-chain in order to redeem their airdrop.
          </p>
          <div className="get-coins__link" onClick={() => shell.openExternal('https://github.com/handshake-org/hs-airdrop')}>
            See full details on GitHub
          </div>
          <h2>Privacy (GooSig)</h2>
          <p>
            <strong>Note:</strong> Since block height 52590 (29 January, 2021) the goosig feature is DISABLED. While it's still possible
            to claim from the airdrop, RSA keys (if used) can be identified on-chain.
          </p>
          <p>
            To preserve privacy, a 32 byte nonce has been encrypted to your PGP or SSH key. No one
            will be able to identify your key fingerprint in the tree published above until you decide to reveal it
            on-chain by decrypting the nonce, creating the proof, and publishing it.
          </p>
          <p>
            GooSig was created for the Handshake Project to address a very specific problem: an airdrop to Github users'
            RSA keys allows Github users to be identified on-chain. In order to anonymize who is receiving coins from
            the airdrop, cryptographic trickery is required: GooSig allows the creation of signatures originating from
            RSA private keys without revealing the RSA public key.
          </p>
          <p>
            GooSig makes use of (G)roups of Unkn(o)wn (O)rder, and implements a cryptographic protocol devised by Dan
            Boneh and Riad S. Wahby at the Stanford Center for Blockchain Research. It was originally ported from the
            python reference implementation to javascript, but has since been implemented in C as well.
          </p>
          <div className="get-coins__link" onClick={() => shell.openExternal('https://github.com/handshake-org/hs-airdrop')}>
            See full details on GitHub
          </div>
        </div>
        <div className="get-coins__right">
          <div className="get-coins__panel">
            <div className="get-coins__panel__offer">
              <div>GitHub Developers</div>
              <div>+ 4,662.598321 HNS</div>
              <div>15 or more followers during the week of 2019-02-04</div>
              <div>SSH/PGP key</div>
              <button onClick={this.openGitHubModal}>Redeem</button>
            </div>
            <div className="get-coins__panel__offer">
              <div>PGP Web of Trust</div>
              <div>+ 4,662.598321 HNS</div>
              <div>Strong set email</div>
              <div>PGP keys</div>
              <button onClick={this.openPGPModal}>Redeem</button>
            </div>
            <div className="get-coins__panel__offer">
              <div>Handshake.org Faucet (Now Closed)</div>
              <div>+ 2,500 HNS and up</div>
              <div>Seed phrase</div>
              <button onClick={this.openFaucetModal}>Redeem</button>
            </div>
            <div className="get-coins__panel__offer">
              <div>Reserved Name Claims</div>
              <div>+ 503 HNS and up</div>
              <div>ICANN root zone TLDs</div>
              <div>Alexa top 100,000</div>
              <button onClick={() => this.props.history.push('/reserved')}>Claim</button>
            </div>
          </div>
        </div>
        {this.renderModal()}
      </div>
    );
  }
}

export default withRouter(GetCoins);
