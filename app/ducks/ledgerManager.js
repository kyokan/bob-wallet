import { store } from '../store/configureStore'
import { hideLedgerModal, showLedgerModal } from './ledger';

let cancellables = {};
let topId = 0;

export function awaitLedger(txId, cb) {
  return new Promise((resolve, reject) => {
    const id = topId++;
    cancellables[id] = reject;
    store.dispatch(showLedgerModal(txId, async () => {
      try {
        await cb();
        resolve();
        store.dispatch(hideLedgerModal());
        return true;
      } catch (e) {
        reject();
        return e;
      } finally {
        delete cancellables[id];
      }
    }));
  });
}

export function cancelLedger() {
  for (const id of Object.keys(cancellables)) {
    cancellables[id](new Error('Cancelled.'));
  }

  cancellables = {};
  store.dispatch(hideLedgerModal());
}
