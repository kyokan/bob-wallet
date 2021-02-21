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
export const PLACE_EXCHANGE_LISTING = 'PLACE_EXCHANGE_LISTING';
export const PLACE_EXCHANGE_LISTING_OK = 'PLACE_EXCHANGE_LISTING/OK';
export const PLACE_EXCHANGE_LISTING_ERR = 'PLACE_EXCHANGE_LISTING/ERR';

export const FINALIZE_EXCHANGE_LOCK = 'FINALIZE_EXCHANGE_LOCK';
export const FINALIZE_EXCHANGE_LOCK_OK = 'FINALIZE_EXCHANGE_LOCK/OK';
export const FINALIZE_EXCHANGE_LOCK_ERR = 'FINALIZE_EXCHANGE_LOCK/ERR';

export const LAUNCH_EXCHANGE_AUCTION = 'LAUNCH_EXCHANGE_AUCTION';
export const LAUNCH_EXCHANGE_AUCTION_OK = 'LAUNCH_EXCHANGE_AUCTION/OK';
export const LAUNCH_EXCHANGE_AUCTION_ERR = 'LAUNCH_EXCHANGE_AUCTION/ERR';


function getInitialState() {
  return {
    listings: [],
    fulfillments: [],
    auctionIds: [],
    auctions: {},
    total: 0,
    isLoading: false,
    isError: false,
    isPlacingBid: false,
    isPlacingBidError: false,
    finalizingName: null,
    isPlacingListing: false,
    isPlacingListingError: false,
  };
}

export const getExchangeAuctions = (page = 1) => async (dispatch, getState) => {
  dispatch({
    type: GET_EXCHANGE_AUCTIONS,
  });

  let auctions;
  let fulfillments;
  let listings;
  try {
    auctions = await client.get(`api/v1/auctions?page=${page}`);
    fulfillments = await shakedex.getFulfillments();
    listings = await shakedex.getListings();
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

    if (!finalizeTx) {
      fulfillment.status = info.chain.height - fulfillTx.height > transferLockup ?
        'CONFIRMED' : 'CONFIRMED_LOCKUP';
      continue;
    }

    fulfillment.status = finalizeTx && finalizeTx.height > -1 ? 'FINALIZED' : 'FINALIZING';
  }

  for (const listing of listings) {
    let transferTx;
    let finalizeTx;
    try {
      transferTx = await nodeClient.getTx(listing.nameLock.transferTxHash);
      finalizeTx = listing.finalizeLock ? await nodeClient.getTx(listing.finalizeLock.finalizeTxHash) : null;
    } catch (e) {
      listing.status = 'NOT_FOUND';
      continue;
    }

    if (!transferTx || transferTx.height === -1) {
      listing.status = 'TRANSFER_CONFIRMING';
      continue;
    }

    if (!finalizeTx) {
      listing.status = info.chain.height - transferTx.height > transferLockup ?
        'TRANSFER_CONFIRMED' : 'TRANSFER_CONFIRMED_LOCKUP';
      continue;
    }

    if (finalizeTx.height === -1) {
      listing.status = 'FINALIZE_CONFIRMING';
    }

    if (!listing.proposals) {
      listing.status = 'FINALIZE_CONFIRMED';
      continue;
    }

    listing.status = 'ACTIVE';
  }

  dispatch({
    type: GET_EXCHANGE_AUCTIONS_OK,
    payload: {
      auctions: auctions.auctions,
      fulfillments,
      listings,
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

  dispatch(getExchangeAuctions());
  dispatch({
    type: PLACE_EXCHANGE_BID_OK,
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

  try {
    await shakedex.finalizeSwap(fulfillment);
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

  dispatch(getExchangeAuctions());
  dispatch({
    type: FINALIZE_EXCHANGE_BID_OK,
  });
  dispatch(showSuccess('Successfully finalized bid! Please wait 15 minutes for it to confirm on-chain.'));
};

export const transferExchangeLock = (name, startPrice, endPrice, durationDays) => async (dispatch) => {
  dispatch({
    type: PLACE_EXCHANGE_LISTING,
  });

  await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));

  try {
    await shakedex.transferLock(name, startPrice, endPrice, durationDays);
  } catch (e) {
    dispatch({
      type: PLACE_EXCHANGE_LISTING_ERR,
      payload: {
        message: e.message,
      },
    });
    return;
  }

  dispatch(getExchangeAuctions());
  dispatch({
    type: PLACE_EXCHANGE_LISTING_OK,
  });
};

export const finalizeExchangeLock = (nameLock) => async (dispatch, getState) => {
  dispatch({
    type: FINALIZE_EXCHANGE_LOCK,
    payload: {
      nameLock,
    },
  });

  await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));

  try {
    await shakedex.finalizeLock(nameLock);
  } catch (e) {
    dispatch({
      type: FINALIZE_EXCHANGE_LOCK_ERR,
      payload: {
        message: e.message,
      },
    });
    dispatch(showError('Failed to finalize auction. Please try again.'));
    return;
  }

  dispatch(getExchangeAuctions());
  dispatch({
    type: FINALIZE_EXCHANGE_LOCK_OK,
  });
  dispatch(showSuccess('Successfully finalized auction! Please wait 15 minutes for it to confirm on-chain.'));
};

export const launchExchangeAuction = (nameLock) => async (dispatch, getState) => {
  dispatch({
    type: LAUNCH_EXCHANGE_AUCTION,
  });

  await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));

  let proposals;
  try {
    proposals = await shakedex.launchAuction(nameLock);
  } catch (e) {
    dispatch({
      type: LAUNCH_EXCHANGE_AUCTION_ERR,
    });
    dispatch(showError('Failed to launch auction. Please try again.'));
    return;
  }

  const first = proposals[0];
  const submission = {
    name: first.name,
    lockingTxHash: first.lockingTxHash,
    lockingOutputIdx: first.lockingOutputIdx,
    publicKey: first.publicKey,
    paymentAddr: first.paymentAddr,
    data: proposals.map(p => ({
      price: p.price,
      lockTime: p.lockTime,
      signature: p.signature,
    })),
  };

  dispatch(getExchangeAuctions());
  dispatch({
    type: LAUNCH_EXCHANGE_AUCTION_OK,
  });

  try {
    // use fetch here since bcurl crashes
    const res = await fetch(`http://localhost:8080/api/v1/auctions`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auction: submission,
      })
    });
    if (res.status !== 201) {
      throw new Error('Error creating auction.');
    }
  } catch (e) {
    console.error(e);
    dispatch(showError('Your auction was successfully launched, however ShakeDex Web rejected it. You can still download your proofs and distribute them.'));
    return;
  }

  dispatch(showSuccess('Successfully launched auction!'));
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
        listings: action.payload.listings,
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
      return {
        ...state,
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
      return {
        ...state,
        finalizingName: null,
      };
    }
    case PLACE_EXCHANGE_LISTING: {
      return {
        ...state,
        isPlacingListing: true,
        isPlacingListingError: false,
      };
    }
    case PLACE_EXCHANGE_LISTING_ERR: {
      return {
        ...state,
        isPlacingListing: false,
        isPlacingListingError: true,
      };
    }
    case PLACE_EXCHANGE_LISTING_OK: {
      return {
        ...state,
        isPlacingListing: false,
        isPlacingListingError: false,
      };
    }
    case FINALIZE_EXCHANGE_LOCK: {
      return {
        ...state,
        finalizingName: action.payload.nameLock.name,
      };
    }
    case FINALIZE_EXCHANGE_LOCK_ERR: {
      return {
        ...state,
        finalizingName: null,
      };
    }
    case FINALIZE_EXCHANGE_LOCK_OK: {
      return {
        ...state,
        finalizingName: null,
      };
    }
    default:
      return state;
  }
}
