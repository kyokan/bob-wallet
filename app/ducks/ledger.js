export const TOGGLE_MODAL = 'ledger/TOGGLE_MODAL';

export function showLedgerModal(txId, cb) {
  return {
    type: TOGGLE_MODAL,
    payload: {
      cb,
      txId,
      isShowingLedgerModal: true
    }
  };
}

export function hideLedgerModal() {
  return {
    type: TOGGLE_MODAL,
    payload: {
      isShowingLedgerModal: false
    }
  }
}

function getInitialState() {
  return {
    isShowingLedgerModal: false,
    cb: () => Promise.resolve(),
  }
}

export default function reducer(state = getInitialState(), action) {
  const {type, payload} = action;

  switch (type) {
    case TOGGLE_MODAL:
      return {
        ...state,
        isShowingLedgerModal: payload.isShowingLedgerModal,
        txId: payload.txId,
        cb: payload.isShowingLedgerModal ? payload.cb : () => Promise.resolve(),
      };
    default:
      return state;
  }
}
