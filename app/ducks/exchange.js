import { Client } from 'bcurl';
import { getPassphrase } from './walletActions.js';
import { clientStub as shakedexClientStub } from '../background/shakedex/client.js';
import { clientStub as nodeClientStub } from '../background/node/client.js';
import { showSuccess, showError } from './notifications.js';
import networks from 'hsd/lib/protocol/networks.js';

const shakedex = shakedexClientStub(() => require('electron').ipcRenderer);
const nodeClient = nodeClientStub(() => require('electron').ipcRenderer);

const client = new Client({
  host: 'localhost',
  port: 8080,
});

export const GET_EXCHANGE_AUCTIONS = 'GET/EXCHANGE_AUCTIONS';
export const GET_EXCHANGE_AUCTIONS_OK = 'GET/EXCHANGE_AUCTIONS/OK';
export const GET_EXCHANGE_AUCTIONS_ERR = 'GET/EXCHANGE_AUCTIONS/ERR';
export const PLACE_EXCHANGE_BID = 'PLACE_EXCHANGE_BID';
export const PLACE_EXCHANGE_BID_OK = 'PLACE_EXCHANGE_BID/OK';
export const PLACE_EXCHANGE_BID_ERR = 'PLACE_EXCHANGE_BID/ERR';
export const FINALIZE_EXCHANGE_BID = 'FINALIZE_EXCHANGE_BID';
export const FINALIZE_EXCHANGE_BID_OK = 'FINALIZE_EXCHANGE_BID/OK';
export const FINALIZE_EXCHANGE_BID_ERR = 'FINALIZE_EXCHANGE_BID/ERR';


function getInitialState() {
  return {
    fulfillments: [],
    auctionIds: [],
    auctions: {},
    total: 0,
    isLoading: false,
    isError: false,
    isPlacingBid: false,
    isPlacingBidError: false,
    finalizingName: null,
  };
}

export const getExchangeAuctions = (page = 1) => async (dispatch, getState) => {
  dispatch({
    type: GET_EXCHANGE_AUCTIONS,
  });

  let auctions;
  let fulfillments;
  try {
    auctions = await client.get(`api/v1/auctions?page=${page}`);
    fulfillments = await shakedex.getFulfillments();
  } catch (e) {
    dispatch({
      type: GET_EXCHANGE_AUCTIONS_ERR,
      payload: {
        message: e.message,
      },
    });
    return;
  }

  const info = await nodeClient.getInfo();
  const transferLockup = networks[info.network].names.transferLockup;

  for (const fulfillment of fulfillments) {
    let fulfillTx;
    let finalizeTx;
    try {
      fulfillTx = await nodeClient.getTx(fulfillment.fulfillment.fulfillmentTxHash);
      finalizeTx = fulfillment.finalize ? await nodeClient.getTx(fulfillment.finalize.finalizeTxHash) : null;
    } catch (e) {
      fulfillment.status = 'NOT_FOUND';
      continue;
    }

    if (!fulfillTx || fulfillTx.height === -1) {
      fulfillment.status = 'CONFIRMING';
      continue;
    }

    if (!finalizeTx && !fulfillment.finalize) {
      fulfillment.status = info.chain.height - fulfillTx.height > transferLockup ?
        'CONFIRMED' : 'CONFIRMED_LOCKUP';
      continue;
    }

    fulfillment.status = finalizeTx && finalizeTx.height > -1 ? 'FINALIZED' : 'FINALIZING';
  }

  dispatch({
    type: GET_EXCHANGE_AUCTIONS_OK,
    payload: {
      auctions: auctions.auctions,
      fulfillments,
    },
  });
};

export const placeExchangeBid = (auction, bid) => async (dispatch, getState) => {
  dispatch({
    type: PLACE_EXCHANGE_BID,
  });

  await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));

  let fulfillment;
  try {
    fulfillment = await shakedex.fulfillSwap(auction, bid);
  } catch (e) {
    dispatch({
      type: PLACE_EXCHANGE_BID_ERR,
      payload: {
        message: e.message,
      },
    });
    return;
  }

  dispatch({
    type: PLACE_EXCHANGE_BID_OK,
    payload: {
      fulfillment,
    },
  });
  dispatch(showSuccess('Bid successfully placed! Please wait 15 minutes for it to confirm on-chain.'));
};

export const finalizeExchangeBid = (fulfillment) => async (dispatch, getState) => {
  dispatch({
    type: FINALIZE_EXCHANGE_BID,
    payload: {
      fulfillment,
    },
  });

  await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));

  let out;
  try {
    out = await shakedex.finalizeSwap(fulfillment);
  } catch (e) {
    dispatch({
      type: FINALIZE_EXCHANGE_BID_ERR,
      payload: {
        message: e.message,
      },
    });
    dispatch(showError('An error occurred finalizing your bid. Please try again.'));
    return;
  }

  dispatch({
    type: FINALIZE_EXCHANGE_BID_OK,
    payload: {
      fulfillment: out,
    },
  });
  dispatch(showSuccess('Successfully finalized bid! Please wait 15 minutes for it to confirm on-chain.'));
};

export default function (state = getInitialState(), action) {
  switch (action.type) {
    case GET_EXCHANGE_AUCTIONS:
      return {
        ...state,
        isLoading: true,
        isError: false,
      };
    case GET_EXCHANGE_AUCTIONS_OK: {
      const auctionIds = [];
      const auctions = action.payload.auctions.reduce((acc, curr) => {
        auctionIds.push(curr.id);
        acc[curr.id] = curr;
        return acc;
      }, {});

      return {
        ...state,
        auctionIds,
        auctions,
        fulfillments: action.payload.fulfillments,
        isLoading: false,
        isError: false,
      };
    }
    case GET_EXCHANGE_AUCTIONS_ERR: {
      return {
        ...state,
        isLoading: false,
        isError: true,
      };
    }
    case PLACE_EXCHANGE_BID: {
      return {
        ...state,
        isPlacingBid: true,
        isPlacingBidError: false,
      };
    }
    case PLACE_EXCHANGE_BID_OK: {
      const {fulfillment} = action.payload;
      const fulfillments = state.fulfillments.slice();
      fulfillments.push(fulfillment);

      return {
        ...state,
        fulfillments,
        isPlacingBid: false,
        isPlacingBidError: false,
      };
    }
    case PLACE_EXCHANGE_BID_ERR: {
      return {
        ...state,
        isPlacingBid: false,
        isPlacingBidError: true,
      };
    }
    case FINALIZE_EXCHANGE_BID: {
      return {
        ...state,
        finalizingName: action.payload.fulfillment.name,
      };
    }
    case FINALIZE_EXCHANGE_BID_OK: {
      const fulfillments = state.fulfillments.slice();
      const idx = fulfillments.findIndex(f => f.name === action.payload.fulfillment.name);
      fulfillments[idx] = action.payload.fulfillment;

      return {
        ...state,
        fulfillments,
        finalizingName: null,
      };
    }
    default:
      return state;
  }
}
