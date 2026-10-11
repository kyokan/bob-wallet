import React, {useContext} from 'react';
import {BigNumber} from 'bignumber.js';
import {I18nContext} from '../../utils/i18n';
import {displayBalance} from '../../utils/balances';
import {balanceReadiness} from '../../utils/balanceReadiness';
import {shell} from '../../renderer/electron';
import {getSafeExternalUrl} from '../../utils/urlPolicy';
import AuctionSummaryStatus, {auctionSummaryTotal} from './AuctionSummaryStatus';

export function balanceGuideUrl(locale) {
  const prefix = new Map([
    ['zh-CN', '/zh'], ['ru-RU', '/ru'], ['th-TH', '/th'],
  ]).get(locale) || '';
  return `https://bobwallet.org${prefix}/docs/wallet-balances/`;
}

export function balanceSnapshotReady(props) {
  return balanceReadiness(props) === 'ready';
}

export default function BalanceSummary(props) {
  const {t} = useContext(I18nContext);
  const readiness = balanceReadiness(props);
  const ready = readiness === 'ready';
  const guideUrl = balanceGuideUrl(props.locale);
  const auctionTotal = ready ? auctionSummaryTotal(props.walletStats) : null;
  const value = amount => ready
    ? `${new BigNumber(displayBalance(amount, false, 2)).toFormat(2)} HNS`
    : t('balanceUpdating');
  const kind = props.walletWatchOnly ? 'overviewWalletWatchOnly'
    : props.walletType === 'multisig' ? 'overviewWalletMultisig' : 'overviewWalletStandard';
  return <section className="overview__hero overview__balance" aria-label={t('balanceDetails')}
    data-balance-readiness={readiness}>
    <div className="overview__hero-main">
      <span className="overview__hero-kicker">{t('balanceSpendableNow')}</span>
      <span className="overview__hero-amount">{value(props.spendableBalance)}</span>
      <span className="overview__hero-meta">{props.walletName} · {t(kind)}</span>
      {ready && props.showUsdValue && props.hnsPrice?.value > 0 &&
        <span className="overview__hero-meta">~${(props.spendableBalance / 1e6 * props.hnsPrice.value).toFixed(2)} {props.hnsPrice.currency || 'USD'}</span>}
    </div>
    <div className="overview__balance-locked">
      <span className="overview__hero-kicker">{t('overviewLockedAuctions')}</span>
      {auctionTotal === null
        ? <AuctionSummaryStatus stats={props.walletStats} onRetry={props.onRetryStats} waiting={!ready} />
        : <span className="overview__hero-chip-value">{new BigNumber(displayBalance(auctionTotal, false, 2)).toFormat(2)} HNS</span>}
      <p>{t('auctionSummaryScope')}</p>
    </div>
    <details className="overview__balance-details">
      <summary>{t('balanceDetails')}</summary>
      <dl>
        <dt>{t('balanceAllCovenantLocks')}</dt><dd>{value(props.lockedUnconfirmed)}</dd>
        <dt>{t('balanceConfirmedTotal')}</dt><dd>{value(props.confirmedBalance)}</dd>
        <dt>{t('balanceCurrentTotal')}</dt><dd>{value(props.unconfirmedBalance)}</dd>
      </dl>
      <p>{t('balanceLockedSummary')}</p>
      <p>{t('balanceTotalsHelp')}</p>
      <p>{t('balanceEquationHelp')}</p>
      <p>{t('balanceBurnHelp')}</p>
      <p>{t('balanceSpendableHelp')}</p>
    </details>
    <a className="overview__balance-guide" href={guideUrl} onClick={event => {
      event.preventDefault();
      const safeUrl = getSafeExternalUrl(guideUrl);
      if (safeUrl) shell.openExternal(safeUrl);
    }}>{t('balanceGuideLink')}</a>
  </section>;
}
