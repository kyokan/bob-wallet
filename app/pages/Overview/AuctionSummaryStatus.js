import React, {useContext} from 'react';
import {I18nContext} from '../../utils/i18n';

export function auctionSummaryTotal(stats) {
  if (!stats || stats.isLoading || stats.error || (stats.status && stats.status !== 'ready')) return null;
  const values = ['bidding', 'revealable', 'finished'].map(key => stats.lockedBalance?.[key]?.HNS);
  return values.every(value => Number.isSafeInteger(value) && value >= 0)
    ? values.reduce((sum, value) => sum + value, 0) : null;
}

export default function AuctionSummaryStatus({stats = {}, onRetry, waiting = false}) {
  const {t} = useContext(I18nContext);
  const failed = !!stats.error || stats.status === 'failed';
  const slow = stats.status === 'slow';
  return <div className="overview__auction-status" role="status" aria-live="polite" aria-busy={!failed}>
    <span>{t(failed ? 'auctionSummaryFailed' : waiting ? 'auctionSummaryWaiting' : slow ? 'auctionSummarySlow' : 'auctionSummaryLoading')}</span>
    {!waiting && stats.elapsedMs > 0 && <small>{t('auctionSummaryElapsed', String(Math.floor(stats.elapsedMs / 1000)))}</small>}
    {failed && <>
      {stats.errorStage && <small>{t('auctionSummaryStage', stats.errorStage)}</small>}
      <small>{t(stats.error === 'busy' ? 'auctionSummaryBusy' : stats.error === 'timeout' ? 'auctionSummaryTimeout' : 'auctionSummaryReadError')}</small>
      <button type="button" onClick={onRetry}>{t('auctionSummaryRetry')}</button>
    </>}
  </div>;
}
