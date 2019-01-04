const SET_AUCTION = 'app/auctions/setAuction';

const API = 'http://127.0.0.1:15037';

const initialState = {};

export const getAuctionInfo = name => async dispatch => {
  // TODO: Get Auction Info Not Found
  // const resp = await fetch(API, {
  //   method: 'POST',
  //   body: JSON.stringify({
  //     method: 'getauctioninfo',
  //     params: [ name ],
  //   }),
  // });
  // const json = await resp.json();

  dispatch({
    type: SET_AUCTION,
    payload: {
      name,
      result: {
        name,
        nameHash:
          '01c05e8ea3d1c347342ef11c50fe5a1f621c942f7f8f7e0ee329eb883f93f9eb',
        state: 'OPENING',
        height: 2003,
        renewal: 2003,
        owner: {
          hash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          index: 4294967295
        },
        value: 0,
        highest: 0,
        data: '',
        transfer: 0,
        revoked: 0,
        claimed: false,
        weak: false,
        stats: {
          openPeriodStart: 2003,
          openPeriodEnd: 2014,
          blocksUntilBidding: 10,
          hoursUntilBidding: 0.83
        },
        bids: [],
        reveals: []
      }
    }
  });
};

export default function auctionsReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case SET_AUCTION:
      return { ...state, [payload.name]: payload.result };
    default:
      return state;
  }
}
