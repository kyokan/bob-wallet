import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import { shell } from 'electron';
import PropTypes from 'prop-types';
import moment from 'moment';
import * as names from '../../ducks/names';
import './my-domain.scss';
import Collapsible from '../../components/Collapsible';
import DomainDetails from './DomainDetails';
import Records from '../../components/Records';
import BidHistory from '../Auction/BidHistory';
import { formatName } from '../../utils/nameHelpers';
import { showError, showSuccess } from '../../ducks/notifications';
import { fetchPendingTransactions } from '../../ducks/walletActions';
import { clientStub as aClientStub } from '../../background/analytics/client';
import TransferDetails from './TransferDetails';
import {I18nContext} from "../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

class MyDomain extends Component {
  static propTypes = {
    domain: PropTypes.object,
    chain: PropTypes.object,
    name: PropTypes.string.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    sendRenewal: PropTypes.func.isRequired,
    explorer: PropTypes.object.isRequired,
  };

  static contextType = I18nContext;

  async componentDidMount() {
    await this.props.getNameInfo();
    await this.props.fetchPendingTransactions();
    analytics.screenView('My Domains');
  }

  handleRegister = async () => {
    try {
      const res = await this.props.sendRegister(this.props.name);
      if (res !== null) {
        this.props.showSuccess(this.context.t('registerSuccess'));
        analytics.track('registered domain');
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  handleRenew = async () => {
    try {
      const res = await this.props.sendRenewal(this.props.name);
      if (res !== null) {
        this.props.showSuccess(this.context.t('renewSuccess'));
        analytics.track('renewed domain');
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  renderRegisterOrRenewal() {
    const {chain} = this.props;
    const {t} = this.context;
    const domain = this.props.domain || {};
    const info = domain.info || {};
    const stats = info.stats || {};

    if (!domain.isOwner) return;

    if (!stats.renewalPeriodStart) {
      return;
    }

    if (chain && (chain.height < stats.renewalPeriodStart)) {
      return;
    }

    // If registered, show renew
    if (info.registered) {
      if (domain.pendingOperation === 'RENEW') {
        return (
          <div
            className="my-domain__header__renewing-link"
          >
            {t('renewing')}...
          </div>
        );
      }

      return (
        <div
          className="my-domain__header__reveal-link"
          onClick={this.handleRenew}
        >
          {t('renew')}
        </div>
      );

    // Else, show register
    } else {
      if (domain.pendingOperation === 'REGISTER') {
        return (
          <div
            className="my-domain__header__renewing-link"
          >
            {t('registering')}...
          </div>
        );
      }

      return (
        <div
          className="my-domain__header__reveal-link"
          onClick={this.handleRegister}
        >
          {t('register')}
        </div>
      );
    }
  }

  render() {
    const {name, history, domain = {}} = this.props;
    const {t} = this.context;

    const viewOnExplorer = () => {
      shell.openExternal(this.props.explorer.name.replace('%s', this.props.domain.name))
    }

    return (
      <div className="my-domain">
        <div
          className="my-domain__back-arrow"
          onClick={() => history.push('/domain_manager')}
        >
          {t('back')}
        </div>
        <div className="my-domain__header">
          <div className="my-domain__header__title">
            {formatName(name)}
            <div
              className="my-domain__header__title__explorer-open-icon"
              onClick={viewOnExplorer} />
          </div>
          <div className="my-domain__header__expires-text">
            {this.renderExpireText()}
          </div>
          {this.renderRegisterOrRenewal()}
        </div>
        <Collapsible className="my-domain__info-panel" title={t('domainDetails')} defaultCollapsed>
          <DomainDetails name={name} />
        </Collapsible>
        <Collapsible className="my-domain__info-panel" title={t('records')} overflowY={false}>
          <Records
            name={name}
            transferring={!!domain.info && domain.info.transfer !== 0}
            editable
          />
        </Collapsible>
        <Collapsible className="my-domain__info-panel" title={t('bidsTitle')} defaultCollapsed>
          {
            this.props.domain
              ? (
                <BidHistory
                  bids={domain.bids || []}
                  reveals={domain.reveals || []}
                />
              )
              : t('loading')
          }
        </Collapsible>
        {
          domain.isOwner && (
            <Collapsible className="my-domain__info-panel" title={t('transfer')} defaultCollapsed>
              <TransferDetails name={name} />
            </Collapsible>
          )
        }
      </div>
    );
  }

  renderExpireText() {
    const {domain} = this.props;

    if (!domain || !domain.info || !domain.info.stats) {
      return;
    }

    const expired = moment().add(domain.info.stats.daysUntilExpire, 'd').format('YYYY-MM-DD');

    return `${this.context.t('expiresOn')} ${expired}`;
  }
}

export default withRouter(
  connect(
    ((state, ownProps) => ({
      name: ownProps.match.params.name,
      domain: state.names[ownProps.match.params.name],
      chain: state.node.chain,
      explorer: state.node.explorer,
    })),
    (dispatch, ownProps) => ({
      getNameInfo: () => dispatch(names.getNameInfo(ownProps.match.params.name)),
      sendRenewal: tld => dispatch(names.sendRenewal(tld)),
      sendRegister: tld => dispatch(names.sendRegister(tld)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      showError: (message) => dispatch(showError(message)),
      fetchPendingTransactions: () => dispatch(fetchPendingTransactions()),
    }),
  )(MyDomain),
);
