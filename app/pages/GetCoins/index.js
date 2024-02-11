import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { shell } from 'electron';
import ProofModal from '../../components/ProofModal/index';
import './get-coins.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';
import NameClaimModal from "../../components/NameClaimModal";
import {I18nContext} from "../../utils/i18n";

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
  static contextType = I18nContext;

  state = {
    isShowingGitHubModal: false,
    isShowingPGPModal: false,
    isShowingFaucetModal: false,
    isShowingNameClaimModal: false,
  };

  componentDidMount() {
    analytics.screenView('Get Coins');
  }

  closeModal = () => this.setState({
    isShowingFaucetModal: false,
    isShowingGitHubModal: false,
    isShowingPGPModal: false,
    isShowingNameClaimModal: false,
  });

  openGitHubModal = () => this.setState({
    isShowingFaucetModal: false,
    isShowingGitHubModal: true,
    isShowingPGPModal: false,
    isShowingNameClaimModal: false,
  });

  openPGPModal = () => this.setState({
    isShowingFaucetModal: false,
    isShowingGitHubModal: false,
    isShowingPGPModal: true,
    isShowingNameClaimModal: false,
  });

  openFaucetModal = () => this.setState({
    isShowingFaucetModal: true,
    isShowingGitHubModal: false,
    isShowingPGPModal: false,
    isShowingNameClaimModal: false,
  });

  openNameClaimModal = () => this.setState({
    isShowingFaucetModal: false,
    isShowingGitHubModal: false,
    isShowingPGPModal: false,
    isShowingNameClaimModal: true,
  });

  renderModal() {
    const {
      isShowingGitHubModal,
      isShowingPGPModal,
      isShowingFaucetModal,
      isShowingNameClaimModal,
    } = this.state;

    if (isShowingNameClaimModal) {
      return (
        <NameClaimModal
          onClose={this.closeModal}
        />
      );
    }

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
    const {t} = this.context;

    return (
      <div className="get-coins">
        <div className="get-coins__left">
          <h1>{t('getCoinTitle')}</h1>
          <div className="get-coins__illustration">
            <div className="get-coins__illustration__col">
              <div className="get-coins__illustration__image-one" />
              <div className="get-coins__illustration__title">~175,000</div>
              <div className="get-coins__illustration__description">{t('getCoinRecipient1')}</div>
            </div>
            <div className="get-coins__illustration__col">
              <div className="get-coins__illustration__image-two" />
              <div className="get-coins__illustration__title">4,246.994314{' '}
                <span className="get-coins__illustration__subtitle">HNS</span>
              </div>
              <div className="get-coins__illustration__description">{t('getCoinRecipient2')}</div>
            </div>
            <div className="get-coins__illustration__col">
              <div className="get-coins__illustration__image-three" />
              <div className="get-coins__illustration__title">70%</div>
              <div className="get-coins__illustration__description">{t('getCoinRecipient3')}</div>
            </div>
          </div>
          <h2>{t('howItWorks')}</h2>
          <p>
            {t('getCoinAirdrop1')}
          </p>
          <p>
            {t('getCoinAirdrop2')}
          </p>
          <p>
            {t('getCoinAirdrop3')}
          </p>
          <div className="get-coins__link" onClick={() => shell.openExternal('https://github.com/handshake-org/hs-airdrop')}>
            {t('getCoinAirdropFooter')}
          </div>
          <h2>{t('getCoinPrivacyTitle')}</h2>
          <p>
            <strong>{t('note')}: </strong>
            {t('getCoinPrivacyNote')}
          </p>
          <p>
            {t('getCoinPrivacy1')}
          </p>
          <p>
            {t('getCoinPrivacy2')}
          </p>
          <p>
            {t('getCoinPrivacy3')}
          </p>
          <div className="get-coins__link" onClick={() => shell.openExternal('https://github.com/handshake-org/hs-airdrop')}>
            {t('getCoinAirdropFooter')}
          </div>
        </div>
        <div className="get-coins__right">
          <div className="get-coins__panel">
            <div className="get-coins__panel__offer">
              <div>{t('getCoinGHDev')}</div>
              <div>+ 4,246.994314 HNS</div>
              <div>{t('getCoinGHDevReq1')}</div>
              <div>{t('getCoinGHDevReq2')}</div>
              <button onClick={this.openGitHubModal}>{t('redeem')}</button>
            </div>
            <div className="get-coins__panel__offer">
              <div>{t('getCoinWoT')}</div>
              <div>+ 4,246.994314 HNS</div>
              <div>{t('getCoinWoTReq1')}</div>
              <div>{t('getCoinWoTReq2')}</div>
              <button onClick={this.openPGPModal}>{t('redeem')}</button>
            </div>
            <div className="get-coins__panel__offer">
              <div>{t('getCoinFaucet')}</div>
              <div>+ 2,500 HNS and up</div>
              <div>{t('getCoinFaucetReq1')}</div>
              <button onClick={this.openFaucetModal}>{t('redeem')}</button>
            </div>
            <div className="get-coins__panel__offer">
              <div>{t('getCoinNameClaim')}</div>
              <div>+ 503 HNS and up</div>
              <div>{t('getCoinNameClaimReq1')}</div>
              <div>{t('getCoinNameClaimReq2')}</div>
              <button onClick={this.openNameClaimModal}>
                {t('claim')}
              </button>
            </div>
          </div>
        </div>
        {this.renderModal()}
      </div>
    );
  }
}

export default withRouter(GetCoins);
