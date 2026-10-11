import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useStore} from 'react-redux';
import {AuctionBasket} from '../../pages/AuctionBasket';
import {sendBidMany, sendRegisterAll} from '../../ducks/names';
import {RegisterAll} from '../../components/RegisterAll';
import walletClient from '../../utils/walletClient';
import {GET_PASSPHRASE, SET_WALLET_NETWORK} from '../../ducks/walletReducer';
import {invalidateWalletRequests, setWallet} from '../../ducks/walletActions';
import {makeClient} from '../ipc/ipc';
import ListingForm from '../../addons/shakex/ListingForm';
import ShakeX from '../../addons/shakex';
import {Records} from '../../components/Records';
import {buildSaleReview} from '../../addons/shakex/records';
import {Resource} from 'hsd/lib/dns/resource';
import {FIXED_RESOURCE} from './data';
import './fixture.scss';
export {FIXED_RESOURCE} from './data';

const acceptance = makeClient(() => require('electron').ipcRenderer, 'Acceptance', ['describe', 'advance']);

const CONTROL_LABELS = {
  'basket-expired': 'Expire first reviewed name',
  'basket-scope-mismatch': 'Change first reviewed bid',
  'basket-wallet-switch': 'Switch fixed fixture wallet',
  'register-reconcile-exact': 'Offer exact candidate ID',
  'register-reconcile-wrong': 'Offer wrong candidate ID',
  'register-wallet-switch': 'Switch fixed fixture wallet',
};

export default function InteractiveFixture() {
  const store = useStore();
  const [fixture, setFixture] = useState(null);
  const [visible, setVisible] = useState(true);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(null);
  const [basketClears, setBasketClears] = useState(0);
  const [saleRoute, setSaleRoute] = useState('');
  const [blockedWrites, setBlockedWrites] = useState(0);
  const appliedWallet = useRef(null);
  const appliedStep = useRef(-1);
  const applyFixture = value => {
    if (value.state.controlStep < appliedStep.current) return;
    appliedStep.current = value.state.controlStep;
    if (appliedWallet.current !== value.walletId) {
      store.dispatch(invalidateWalletRequests(value.walletId));
      store.dispatch({type: SET_WALLET_NETWORK, payload: 'regtest'});
      store.dispatch(setWallet({wid: value.walletId, type: 'hot', balance: {
        confirmed: 0, unconfirmed: 0, lockedConfirmed: 0, lockedUnconfirmed: 0,
      }}));
      appliedWallet.current = value.walletId;
    }
    setFixture(value);
  };
  useEffect(() => {
    let active = true;
    const update = () => acceptance.describe().then(value => {if(active)applyFixture(value);})
      .catch(error => {if(active)setNotice(error.message);});
    update();
    const timer = setInterval(update, 500);
    return () => {active=false;clearInterval(timer);};
  }, []);
  const names = useMemo(() => fixture
    ? fixture.plan.names || (fixture.plan.name ? [fixture.plan.name] : [])
    : [], [fixture?.plan.scenario]);
  const items = useMemo(() => Object.fromEntries(names.map(name => [name, {
    name, bidAmount: fixture?.plan.fixtureType === 'basket-scope-mismatch'
      && fixture?.state.controlStep === 1 && name === names[0] ? '2' : '1', blindAmount: '1',
  }])), [names, fixture?.plan.fixtureType, fixture?.state.controlStep]);
  if (!fixture) return <main><p>Preparing isolated acceptance fixture...</p><p role="alert">{notice}</p></main>;
  const getState = () => store.getState();
  const dispatch = action => {
    if (typeof action === 'function') return action(dispatch, getState);
    if (action?.type === GET_PASSPHRASE) return action.payload.resolve();
    return store.dispatch(action);
  };
  const submit = (entries, options) => sendBidMany(entries, options)(dispatch, getState);
  const stage = values => {
    try {
      const hex = Resource.fromJSON(FIXED_RESOURCE).encode().toString('hex');
      const result = buildSaleReview(hex, values);
      const unchanged = result.afterResource.records.filter(record => record.type !== 'TXT'
        || !record.txt.some(text => text.startsWith('v=FORSALE1;')));
      const before = result.beforeResource.records.filter(record => record.type !== 'TXT'
        || !record.txt.some(text => text.startsWith('v=FORSALE1;')));
      if (JSON.stringify(unchanged) !== JSON.stringify(before)) throw new Error('Unrelated DNS records changed.');
      setReview(result);setNotice('Fixed local resource review preserves NS, DS and ordinary TXT records. Submission is disabled.');
    } catch(error) {setNotice(error.message);}
  };
  return <main className="acceptance-fixture">
    <h2>Isolated acceptance: {fixture.plan.scenario}</h2>
    <p role="alert">{notice}</p>
    {CONTROL_LABELS[fixture.plan.fixtureType] && fixture.state.controlStep <
      (fixture.plan.fixtureType.endsWith('-switch') ? 2 : 1) &&
      <button type="button" onClick={() => acceptance.advance().then(() => acceptance.describe())
        .then(applyFixture).catch(error => setNotice(error.message))}>
        {CONTROL_LABELS[fixture.plan.fixtureType]}
      </button>}
    <button type="button" onClick={()=>setVisible(value=>!value)}>{fixture.registration
      ? (visible?'Leave registrations':'Return to registrations') : (visible?'Leave basket':'Return to basket')}</button>
    <pre data-testid="acceptance-state">{JSON.stringify(fixture.state,null,2)}</pre>
    <output data-testid="acceptance-renderer-generation">{store.getState().wallet.requestGeneration}</output>
    <output data-testid="acceptance-basket-clears">{basketClears}</output>
    {fixture.registration && <pre data-testid="acceptance-register-state">{JSON.stringify(fixture.registration,null,2)}</pre>}
    {visible && fixture.registration && <RegisterAll walletId={fixture.walletId} network="regtest"
      eligibilityReady={true} registerable={{num: fixture.plan.registrationNames.length - fixture.registration.acceptedNames.length, verified: false}}
      requestGeneration={store.getState().wallet.requestGeneration}
      getStatus={context=>walletClient.getRegisterAllStatus(context)}
      cancel={context=>walletClient.cancelRegisterAll(context)}
      submit={(isCurrent,operationId)=>sendRegisterAll(isCurrent,operationId)(dispatch,getState)} />}
    {fixture.plan.fixtureType === 'restore-history' && <pre data-testid="acceptance-restore-evidence">
      {JSON.stringify(fixture.restoreEvidence || {status: 'Preparing generated regtest replay'}, null, 2)}
    </pre>}
    {visible && names.length>0 && <AuctionBasket
      order={basketClears ? [] : names} items={items} network="regtest" walletId={fixture.walletId}
      spendableBalance={1000000000000} watchOnly={false} walletType="hot"
      addNamesToBasket={()=>({added:0})} removeFromBasket={()=>{}}
      updateBasketItem={()=>{}} importBasketRows={()=>{}} clearBasket={()=>setBasketClears(count=>count+1)}
      sendBidMany={submit} showError={setNotice} showSuccess={setNotice} history={{push:()=>setVisible(false)}}
    />}
    <ListingForm resource={FIXED_RESOURCE} onStage={stage} disabled={false}/>
    {review && <pre data-testid="acceptance-resource-review">{JSON.stringify(review,null,2)}</pre>}
    <ShakeX />
    {fixture.plan.fixtureType === 'owned-name-sell' && <div className="my-domain">
      <Records name="fixture-owned" network="regtest" walletId={fixture.walletId}
        walletGeneration={store.getState().wallet.requestGeneration}
        domain={{isOwner: true, info: {registered: true}}} resource={FIXED_RESOURCE}
        currentHeight={1000} editable sellingOptions transferring={false} deeplinkParams={{}}
        showSuccess={() => {}} sendUpdate={() => {setBlockedWrites(count => count + 1); throw new Error('Acceptance DNS write blocked.');}}
        clearDeeplinkParams={() => {}} loadCanonicalNameInfo={async () => ({info: {data: '00'}})}
        refreshCanonicalNameInfo={async () => ({info: {data: '00'}})}
        openProposalFile={() => {throw new Error('Acceptance file picker blocked.');}}
        readProposalFile={() => {throw new Error('Acceptance file read blocked.');}}
        history={{push: route => setSaleRoute(route)}} />
      <pre data-testid="acceptance-sell-state">{JSON.stringify({saleRoute, blockedWrites})}</pre>
    </div>}
  </main>;
}
