import { Client } from 'bcurl';
import { getPassphrase } from './walletActions.js';
import { clientStub as shakedexClientStub } from '../background/shakedex/client.js';
import { clientStub as nodeClientStub } from '../background/node/client.js';
import { showSuccess, showError } from './notifications.js';
import networks from 'hsd/lib/protocol/networks.js';
import {getFinalizeFromTransferTx} from "../utils/shakedex";

const shakedex = shakedexClientStub(() => require('electron').ipcRenderer);
const nodeClient = nodeClientStub(() => require('electron').ipcRenderer);

const client = new Client({
  host: 'api.shakedex.com',
  ssl: true,
});

export const GET_EXCHANGE_AUCTIONS = 'GET/EXCHANGE_AUCTIONS';
export const GET_EXCHANGE_AUCTIONS_OK = 'GET/EXCHANGE_AUCTIONS/OK';
export const GET_EXCHANGE_AUCTIONS_ERR = 'GET/EXCHANGE_AUCTIONS/ERR';

export const GET_EXCHANGE_FULLFILLMENTS = 'GET/EXCHANGE_FULLFILLMENTS';
export const GET_EXCHANGE_FULLFILLMENTS_OK = 'GET/EXCHANGE_FULLFILLMENTS/OK';
export const GET_EXCHANGE_FULLFILLMENTS_ERR = 'GET/EXCHANGE_FULLFILLMENTS/ERR';

export const GET_EXCHANGE_LISTINGS = 'GET/EXCHANGE_LISTINGS';
export const GET_EXCHANGE_LISTINGS_OK = 'GET/EXCHANGE_LISTINGS/OK';
export const GET_EXCHANGE_LISTINGS_ERR = 'GET/EXCHANGE_LISTINGS/ERR';

export const PLACE_EXCHANGE_BID = 'PLACE_EXCHANGE_BID';
export const PLACE_EXCHANGE_BID_OK = 'PLACE_EXCHANGE_BID/OK';
export const PLACE_EXCHANGE_BID_ERR = 'PLACE_EXCHANGE_BID/ERR';

export const FINALIZE_EXCHANGE_BID = 'FINALIZE_EXCHANGE_BID';
export const FINALIZE_EXCHANGE_BID_OK = 'FINALIZE_EXCHANGE_BID/OK';
export const FINALIZE_EXCHANGE_BID_ERR = 'FINALIZE_EXCHANGE_BID/ERR';

export const CANCEL_EXCHANGE_LISTING = 'CANCEL_EXCHANGE_LISTING';
export const CANCEL_EXCHANGE_LISTING_OK = 'CANCEL_EXCHANGE_LISTING/OK';
export const CANCEL_EXCHANGE_LISTING_ERR = 'CANCEL_EXCHANGE_LISTING/ERR';

export const FINALIZE_CANCEL_EXCHANGE_LISTING = 'FINALIZE_CANCEL_EXCHANGE_LISTING';
export const FINALIZE_CANCEL_EXCHANGE_LISTING_OK = 'FINALIZE_CANCEL_EXCHANGE_LISTING/OK';
export const FINALIZE_CANCEL_EXCHANGE_LISTING_ERR = 'FINALIZE_CANCEL_EXCHANGE_LISTING/ERR';

export const PLACE_EXCHANGE_LISTING = 'PLACE_EXCHANGE_LISTING';
export const PLACE_EXCHANGE_LISTING_OK = 'PLACE_EXCHANGE_LISTING/OK';
export const PLACE_EXCHANGE_LISTING_ERR = 'PLACE_EXCHANGE_LISTING/ERR';

export const FINALIZE_EXCHANGE_LOCK = 'FINALIZE_EXCHANGE_LOCK';
export const FINALIZE_EXCHANGE_LOCK_OK = 'FINALIZE_EXCHANGE_LOCK/OK';
export const FINALIZE_EXCHANGE_LOCK_ERR = 'FINALIZE_EXCHANGE_LOCK/ERR';

export const LAUNCH_EXCHANGE_AUCTION = 'LAUNCH_EXCHANGE_AUCTION';
export const LAUNCH_EXCHANGE_AUCTION_OK = 'LAUNCH_EXCHANGE_AUCTION/OK';
export const LAUNCH_EXCHANGE_AUCTION_ERR = 'LAUNCH_EXCHANGE_AUCTION/ERR';

export const SET_AUCTIONS_PAGE = 'SET_AUCTION_PAGE';

export const LISTING_STATUS = {
  NOT_FOUND: 'NOT_FOUND',
  TRANSFER_CONFIRMING: 'TRANSFER_CONFIRMING',
  TRANSFER_CONFIRMED: 'TRANSFER_CONFIRMED',
  TRANSFER_CONFIRMED_LOCKUP: 'TRANSFER_CONFIRMED_LOCKUP',
  FINALIZE_CONFIRMING: 'FINALIZE_CONFIRMING',
  FINALIZE_CONFIRMED: 'FINALIZE_CONFIRMED',
  ACTIVE: 'ACTIVE',
  SOLD: 'SOLD',
  CANCEL_CONFIRMING: 'CANCEL_CONFIRMING',
  CANCEL_CONFIRMED: 'CANCEL_CONFIRMED',
  FINALIZE_CANCEL_CONFIRMING: 'FINALIZE_CANCEL_CONFIRMING',
  FINALIZE_CANCEL_CONFIRMED: 'FINALIZE_CANCEL_CONFIRMED',
};

export const FULFILLMENT_STATUS = {
  NOT_FOUND: 'NOT_FOUND',
  CONFIRMING: 'CONFIRMING',
  CONFIRMED: 'CONFIRMED',
  CONFIRMED_LOCKUP: 'CONFIRMED_LOCKUP',
  FINALIZED: 'FINALIZED',
  FINALIZING: 'FINALIZING',
};


function getInitialState() {
  return {
    listings: [],
    fulfillments: [],
    auctionIds: [],
    auctions: {},
    total: 0,
    currentPage: 1,
    isLoading: false,
    isError: false,
    isPlacingBid: false,
    isPlacingBidError: false,
    finalizingName: null,
    isPlacingListing: false,
    isPlacingListingError: false,
  };
}

export const setAuctionPage = (page) => ({
  type: SET_AUCTIONS_PAGE,
  payload: page,
});

export const getExchangeAuctions = () => async (dispatch, getState) => {
  dispatch({
    type: GET_EXCHANGE_AUCTIONS,
  });

  let auctions;

  const {
    exchange: {
      currentPage,
    },
  } = getState();

  try {
    auctions = await shakedex.getExchangeAuctions(currentPage);
  } catch (e) {
    dispatch({
      type: GET_EXCHANGE_AUCTIONS_ERR,
      payload: {
        message: e.message,
      },
    });
    return;
  }

  dispatch({
    type: GET_EXCHANGE_AUCTIONS_OK,
    payload: {
      auctions: auctions.auctions,
      total: +auctions.total,
    },
  });
};

export const getExchangeFullfillments = () => async dispatch => {
  dispatch({
    type: GET_EXCHANGE_FULLFILLMENTS,
  });

  let fulfillments;
  try {
    fulfillments = await shakedex.getFulfillments();
  } catch (e) {
    dispatch({
      type: GET_EXCHANGE_FULLFILLMENTS_ERR,
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
      fulfillment.status = FULFILLMENT_STATUS.NOT_FOUND;
      continue;
    }

    if (!fulfillTx || fulfillTx.height === -1) {
      fulfillment.status = FULFILLMENT_STATUS.CONFIRMING;
      continue;
    }

    if (!finalizeTx) {
      fulfillment.status = info.chain.height - fulfillTx.height > transferLockup ?
        FULFILLMENT_STATUS.CONFIRMED : FULFILLMENT_STATUS.CONFIRMED_LOCKUP;
      continue;
    }

    fulfillment.status = finalizeTx && finalizeTx.height > -1 ? FULFILLMENT_STATUS.FINALIZED : FULFILLMENT_STATUS.FINALIZING;
  }

  dispatch({
    type: GET_EXCHANGE_FULLFILLMENTS_OK,
    payload: {
      fulfillments,
    },
  });
};

export const getExchangeListings = (page = 1) => async (dispatch, getState) => {
  dispatch({
    type: GET_EXCHANGE_LISTINGS,
  });

  let listings;
  try {
    listings = await shakedex.getListings();
  } catch (e) {
    dispatch({
      type: GET_EXCHANGE_LISTINGS_ERR,
      payload: {
        message: e.message,
      },
    });
    return;
  }

  const mtp = await nodeClient.getMTP();
  const info = await nodeClient.getInfo();
  const transferLockup = networks[info.network].names.transferLockup;

  for (const listing of listings) {
    console.log({ listing });

    // deprecated: auction version 1
    listing.deprecated = false;

    // safe: either all bids released or auction not active
    listing.safe = true;

    let transferTx;
    let finalizeTx;
    let finalizeCoin;
    let cancelTx;
    let cancelFinalizeTx;
    let cancelCoin;
    try {
      transferTx = await nodeClient.getTx(listing.nameLock.transferTxHash);

      const finalize = await getFinalizeFromTransferTx(
        listing.nameLock.transferTxHash,
        listing.nameLock.name,
        nodeClient,
      );

      finalizeTx = finalize.tx;
      finalizeCoin = finalize.coin;

      cancelTx = listing.nameLockCancel
        ? await nodeClient.getTx(listing.nameLockCancel.transferTxHash)
        : null;
      cancelFinalizeTx = listing.cancelFinalize
        ? await nodeClient.getTx(listing.cancelFinalize.finalizeTxHash)
        : null;
      cancelCoin = listing.cancelFinalize
        ? await nodeClient.getCoin(listing.cancelFinalize.finalizeTxHash, listing.cancelFinalize.finalizeOutputIdx)
        : null;
    } catch (e) {
      listing.status = LISTING_STATUS.NOT_FOUND;
      continue;
    }

    if (!transferTx || transferTx.height === -1) {
      listing.status = LISTING_STATUS.TRANSFER_CONFIRMING;
      continue;
    }

    if (!finalizeTx) {
      listing.status = info.chain.height - transferTx.height > transferLockup
        ? LISTING_STATUS.TRANSFER_CONFIRMED
        : LISTING_STATUS.TRANSFER_CONFIRMED_LOCKUP;
      continue;
    }

    if (finalizeTx.height === -1) {
      listing.status = LISTING_STATUS.FINALIZE_CONFIRMING;
      continue;
    }

    if (!listing.auction) {
      listing.status = LISTING_STATUS.FINALIZE_CONFIRMED;
      continue;
    }

    const version = listing.auction.version || 1;

    if (version < 2) {
      listing.deprecated = true;
    }

    // Name transferred and finalized into lockscript
    if (finalizeCoin) {
      listing.status = LISTING_STATUS.ACTIVE;

      if (listing.deprecated) {
        const futureBids = listing.auction.data.filter(bid => bid.lockTime > mtp);

        if (futureBids.length > 0) {
          listing.safe = false;

          // lowestDeprecatedPrice:
          // when v1 auction isn't cancelled, the lowest value of all bids
          listing.lowestDeprecatedPrice = Math.min(...futureBids.map(bid => bid.price));
        }
      }
      continue;
    }

    // Auction cancelled and name being transferred back
    if (cancelTx && !cancelFinalizeTx) {
      listing.status = cancelTx.height > 0 && info.chain.height - cancelTx.height > transferLockup
        ? LISTING_STATUS.CANCEL_CONFIRMED
        : LISTING_STATUS.CANCEL_CONFIRMING;
      continue;
    }

    // Auction cancelled and name return transfer finalizing
    if (cancelFinalizeTx && cancelFinalizeTx.height === -1) {
      listing.status = LISTING_STATUS.FINALIZE_CANCEL_CONFIRMING;
      continue;
    }

    // At this point, the presigns no longer work
    listing.deprecated = false;

    // Auction cancelled and name return finalized
    if (cancelCoin) {
      listing.status = LISTING_STATUS.FINALIZE_CANCEL_CONFIRMED;
      continue;
    }

    listing.status = LISTING_STATUS.SOLD;
  }

  dispatch({
    type: GET_EXCHANGE_LISTINGS_OK,
    payload: {
      listings,
    },
  });
};

export const placeExchangeBid = (auction, bid) => async (dispatch, getState) => {
  dispatch({
    type: PLACE_EXCHANGE_BID,
  });

  let fulfillment;
  try {
    const passphrase = await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));
    fulfillment = await shakedex.fulfillSwap(auction, bid, passphrase);
  } catch (e) {
    console.error(e);
    dispatch({
      type: PLACE_EXCHANGE_BID_ERR,
      payload: {
        message: e.message,
      },
    });
    return;
  }

  dispatch(getExchangeListings());
  dispatch(getExchangeFullfillments());
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

  const passphrase = await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));

  try {
    await shakedex.finalizeSwap(fulfillment, passphrase);
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

  dispatch(getExchangeFullfillments());
  dispatch({
    type: FINALIZE_EXCHANGE_BID_OK,
  });
  dispatch(showSuccess('Successfully finalized bid! Please wait 15 minutes for it to confirm on-chain.'));
};

export const transferExchangeLock = (name, startPrice, endPrice, durationDays) => async (dispatch) => {
  dispatch({
    type: PLACE_EXCHANGE_LISTING,
  });

  try {
    const passphrase = await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));
    await shakedex.transferLock(name, startPrice, endPrice, durationDays, passphrase);
  } catch (e) {
    dispatch({
      type: PLACE_EXCHANGE_LISTING_ERR,
      payload: {
        message: e.message,
      },
    });
    throw e;
  }

  dispatch(getExchangeListings());
  dispatch({
    type: PLACE_EXCHANGE_LISTING_OK,
  });
};


export const cancelExchangeLock = (nameLock) => async (dispatch) => {
  dispatch({
    type: CANCEL_EXCHANGE_LISTING,
  });

  // Coerce into array if single nameLock
  const nameLocks = Array.isArray(nameLock) ? nameLock : [nameLock]

  try {
    const passphrase = await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));
    for (const nl of nameLocks) {
      await shakedex.transferCancel(nl, passphrase);
    }
  } catch (e) {
    dispatch({
      type: CANCEL_EXCHANGE_LISTING_ERR,
      payload: {
        message: e.message,
      },
    });
    dispatch(showError(e.message));
    throw e;
  }

  dispatch(getExchangeListings());
  dispatch({
    type: CANCEL_EXCHANGE_LISTING_OK,
  });
  dispatch(showSuccess('Transferring name back to your wallet. Don\'t forget to finalize after transfer period is over.'));
};

export const finalizeCancelExchangeLock = (nameLock) => async (dispatch) => {
  dispatch({
    type: FINALIZE_CANCEL_EXCHANGE_LISTING,
  });

  // Coerce into array if single nameLock
  const nameLocks = Array.isArray(nameLock) ? nameLock : [nameLock]

  try {
    const passphrase = await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));
    for (const nl of nameLocks) {
      await shakedex.finalizeCancel(nl, passphrase);
    }
  } catch (e) {
    dispatch({
      type: FINALIZE_CANCEL_EXCHANGE_LISTING_ERR,
      payload: {
        message: e.message,
      },
    });
    dispatch(showError(e.message));
    throw e;
  }

  dispatch(getExchangeListings());
  dispatch({
    type: FINALIZE_CANCEL_EXCHANGE_LISTING_OK,
  });
  dispatch(showSuccess('Successfully finalized transfer! Please wait 15 minutes for it to confirm on-chain.'));
};

export const finalizeExchangeLock = (nameLock) => async (dispatch, getState) => {
  dispatch({
    type: FINALIZE_EXCHANGE_LOCK,
    payload: {
      nameLock,
    },
  });


  try {
    const passphrase = await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));
    await shakedex.finalizeLock(nameLock, passphrase);
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

  dispatch(getExchangeListings());
  dispatch({
    type: FINALIZE_EXCHANGE_LOCK_OK,
  });
  dispatch(showSuccess('Successfully finalized auction! Please wait 15 minutes for it to confirm on-chain.'));
};

export const launchExchangeAuction = (nameLock, overrideParams) => async (dispatch, getState) => {
  dispatch({
    type: LAUNCH_EXCHANGE_AUCTION,
  });

  try {
    const passphrase = await new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject)));
    await shakedex.launchAuction(nameLock, passphrase, overrideParams, true);
  } catch (e) {
    console.log(e);
    dispatch({
      type: LAUNCH_EXCHANGE_AUCTION_ERR,
    });
    dispatch(showError('Failed to generate presigns. Please try again.'));
    return;
  }

  dispatch(getExchangeListings());
  dispatch({
    type: LAUNCH_EXCHANGE_AUCTION_OK,
  });

  dispatch(showSuccess('Successfully generated presigns! You can post your auctions to Shakedex, or download and distribute however you wish.'));
};

export const submitToShakedex = (auction) => async dispatch => {
  try {
    const json = await shakedex.listAuction(auction);
    if (json.error) {
      dispatch(showError(json.error.message));
      return;
    }

    dispatch(showSuccess('Your auction is now listed on Shakedex Web'));
  } catch (e) {
    console.error(e);
    dispatch(showError('Failed to post to Shakedex Web. You can still download your proofs and distribute them.'));
  }
};

export default function (state = getInitialState(), action) {
  switch (action.type) {
    case GET_EXCHANGE_AUCTIONS:
      return {
        ...state,
        isLoading: true,
        isError: false,
      };

    case GET_EXCHANGE_AUCTIONS_OK:
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
        isLoading: false,
        isError: false,
        total: action.payload.total,
      };

    case GET_EXCHANGE_AUCTIONS_ERR:
      return {
        ...state,
        isLoading: false,
        isError: true,
      };

    case GET_EXCHANGE_FULLFILLMENTS_OK:
      return {
        ...state,
        fulfillments: action.payload.fulfillments,
        isLoading: false,
        isError: false,
      };

    case GET_EXCHANGE_FULLFILLMENTS_ERR:
      return {
        ...state,
        isLoading: false,
        isError: true,
      };

    case GET_EXCHANGE_LISTINGS_OK:
      return {
        ...state,
        listings: action.payload.listings,
        isLoading: false,
        isError: false,
      };

    case GET_EXCHANGE_LISTINGS_ERR:
      return {
        ...state,
        isLoading: false,
        isError: true,
      };

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
    case SET_AUCTIONS_PAGE:
      return {
        ...state,
        currentPage: action.payload,
      };
    default:
      return state;
  }
}
