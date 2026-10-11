import React, {Component} from 'react';
import {connect} from 'react-redux';
import walletClient from '../../utils/walletClient';
import {sendRegisterAll} from '../../ducks/names';
import {I18nContext} from '../../utils/i18n';
import './register-all.scss';

export class RegisterAll extends Component {
  static contextType = I18nContext;
  state = {operation: null, loaded: false, busy: false, error: ''};
  generation = 0;
  mounted = false;
  submitting = false;

  componentDidMount() {
    this.mounted = true;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 1500);
  }

  componentDidUpdate(previous) {
    if (previous.walletId !== this.props.walletId || previous.network !== this.props.network
        || previous.requestGeneration !== this.props.requestGeneration) {
      this.stop();
      this.generation++;
      this.submitting = false;
      this.setState({operation: null, loaded: false, busy: false, error: ''});
      this.refresh();
    }
  }

  componentWillUnmount() {
    this.stop();
    this.mounted = false;
    this.generation++;
    clearInterval(this.timer);
  }

  stop = () => {
    if (!this.operationContext && this.state.operation?.running && this.state.operation.operationId) {
      this.operationContext = {walletId: this.state.operation.walletId, network: this.state.operation.network,
        operationId: this.state.operation.operationId};
    }
    if (!this.operationContext) return;
    const context = this.operationContext;
    const generation = this.generation;
    this.props.cancel(context).then(acknowledged => {
      if (acknowledged && this.operationContext === context) this.operationContext = null;
    }).catch(error => {
      if (this.mounted && generation === this.generation) this.setState({error: error.message});
    });
  };

  refresh = async () => {
    if (this.refreshing || !this.props.walletId) return;
    const generation = this.generation;
    this.refreshing = true;
    let timer;
    try {
      const operation = await Promise.race([
        this.props.getStatus({walletId: this.props.walletId, network: this.props.network}),
        new Promise((_, reject) => {timer = setTimeout(() => reject(new Error(this.context.t('registrationStatusTimeout'))), 10000);}),
      ]);
      if (this.mounted && generation === this.generation) this.setState({operation, loaded: true});
    } catch (error) {
      if (this.mounted && generation === this.generation) this.setState({loaded: false, error: error.message});
    } finally {
      clearTimeout(timer);
      this.refreshing = false;
    }
  };

  start = async () => {
    if (this.submitting || !this.state.loaded || this.state.operation?.retryLocked) return;
    if (!this.canStart()) return;
    const generation = this.generation;
    const operationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.operationContext = {walletId: this.props.walletId, network: this.props.network, operationId};
    this.submitting = true;
    this.setState({busy: true, error: ''});
    const isCurrent = () => this.mounted && generation === this.generation;
    try {
      const operation = await this.props.submit(() => isCurrent() && this.operationContext?.operationId === operationId, operationId);
      if (isCurrent()) this.setState(operation?.noWork
        ? {error: this.context.t('registrationNoWork')}
        : {operation});
    } catch (error) {
      if (isCurrent()) this.setState({error: ['registrationNoWork', 'registrationPreflightTimeout'].includes(error.code)
        ? this.context.t(error.code) : error.message});
    } finally {
      if (isCurrent()) {
        this.submitting = false;
        if (this.operationContext?.operationId === operationId) this.operationContext = null;
        this.setState({busy: false});
        this.refresh();
      }
    }
  };

  canStart = () => {
    const {operation} = this.state;
    if (!this.props.eligibilityReady) return false;
    if (operation?.status === 'complete') return (operation.settledComplete || operation.confirmedComplete) && operation.eligibleCount > 0;
    return this.props.registerable?.num > 0;
  };

  render() {
    const {t} = this.context;
    const {operation, loaded, busy, error} = this.state;
    const running = busy || operation?.running;
    const entries = operation?.entries || [];
    const submitted = entries.filter(e => e.status === 'submitted').length;
    const eligible = this.canStart();
    const eligibleCount = operation?.status === 'complete' ? operation.eligibleCount : this.props.registerable?.num;
    const archived = (operation?.settledComplete || operation?.confirmedComplete) && !running && !operation.retryLocked;
    const recovery = operation && !archived;
    if (!eligible && !recovery && !archived && !error) return null;
    const results = <details open={operation?.status === 'paused'}>
      <summary>{t(archived ? 'registrationHistory' : 'registrationResults')}</summary>
      <table><thead><tr><th>{t('registrationName')}</th><th>{t('registrationStage')}</th><th>{t('registrationTransaction')}</th></tr></thead>
        <tbody>{entries.map(entry => <tr key={entry.name}>
          <td>{entry.name}/</td><td>{t(`registrationState_${entry.status}`)}{entry.status !== entry.stage && <> / {t(`registrationState_${entry.stage}`)}</>}</td>
          <td>{entry.txid && <code>{entry.txid}</code>}{entry.error && <p>{entry.error}</p>}</td>
        </tr>)}</tbody>
      </table>
    </details>;
    if (archived && !eligible) return entries.length ? <section className="register-all register-all--history">{results}</section> : null;
    return (
      <section className="register-all" aria-label={t('registerAll')}>
        <h3>{t('register')}{eligible ? ` ${eligibleCount} ${t('domains')}` : ''}</h3>
        {eligible && <p>{operation?.status !== 'complete' && this.props.registerable.verified
          ? t('registerCardWarning', Math.round(this.props.registerable.HNS / 1e6))
          : t('registerCardVerifyWarning')}</p>}
        {(eligible || running) && <button type="button" onClick={this.start} disabled={!loaded || running || operation?.retryLocked || !eligible}>
          {running ? t('registrationRunning') : operation?.status === 'paused' ? t('registrationResume') : t('registerAll')}
        </button>}
        {(eligible || running) && <p>{t('registrationLeaveWarning')}</p>}
        {running && <button type="button" onClick={this.stop}>{t('registrationStop')}</button>}
        {error && <p role="alert">{error}</p>}
        {recovery && <div aria-live="polite">
          <p>{t('registrationProgress', submitted, entries.length)}</p>
          {operation.status === 'complete' && <p>{t('registrationPendingConfirmation')}</p>}
          {operation.failedName && <p>{t('registrationStoppedAt', operation.failedName, t(`registrationState_${operation.failedStage}`))}</p>}
          {!!operation.notAttempted?.length && <p>{t('registrationNotAttempted', operation.notAttempted.join(', '))}</p>}
          {operation.retryLocked && !running && <p role="alert">{t('registrationUncertain')}</p>}
          {!running && operation.status === 'paused' && !operation.retryLocked && <p>{t('registrationResumeHelp')}</p>}
          {results}
        </div>}
        {archived && results}
      </section>
    );
  }
}

export default connect(state => ({
  walletId: state.wallet.wid,
  network: state.wallet.network,
  requestGeneration: state.wallet.requestGeneration,
  registerable: state.walletStats.actionableInfo.registerable,
  eligibilityReady: state.wallet.balanceReady && !state.wallet.walletSync
    && state.node.chain.progress >= 0.9999 && !state.walletStats.isLoading && !state.walletStats.error,
}), dispatch => ({
  submit: (isCurrent, operationId) => dispatch(sendRegisterAll(isCurrent, operationId)),
  cancel: context => walletClient.cancelRegisterAll(context),
  getStatus: context => walletClient.getRegisterAllStatus(context),
}))(RegisterAll);
