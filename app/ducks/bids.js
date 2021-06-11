import walletClient from '../utils/walletClient';

const SET_YOUR_BIDS = 'app/bids/setYourBids';
const SET_BIDS_FILTER = 'app/bids/setBidsFilter';

const initialState = {
  map: {},
  order: [],
  filter: {
    OPENING: [],
    BIDDING: [],
    REVEAL: [],
    CLOSED: [],
    TRANSFER: [],
  },
};

export const setYourBids = ({ order, map }) => ({
  type: SET_YOUR_BIDS,
  payload: {
    order,
    map,
  },
});

export const setFilter = (filter = {}) => ({
  type: SET_BIDS_FILTER,
  payload: filter,
});

export const getYourBids = () => async (dispatch) => {
  const {bids, filter} = await walletClient.getBids();

  const yourBids = bids.filter(({ own }) => own);

  const order = yourBids.map(bid => {
    return bid.prevout.hash + bid.prevout.index;
  });

  const map = yourBids.reduce((acc, bid) => {
    const id = bid.prevout.hash + bid.prevout.index;
    acc[id] = bid;
    return acc;
  }, {});

  if (yourBids && yourBids.length) {
    dispatch(setYourBids({ order, map }));
    dispatch(setFilter({
      OPENING: filter.OPENING.filter(id => !!map[id]),
      BIDDING: filter.BIDDING.filter(id => !!map[id]),
      REVEAL: filter.REVEAL.filter(id => !!map[id]),
      CLOSED: filter.CLOSED.filter(id => !!map[id]),
      TRANSFER: filter.TRANSFER.filter(id => !!map[id]),
    }));
  }
};

export default function bidsReducer(state = initialState, action) {
  const {type, payload} = action;

  switch (type) {
    case SET_YOUR_BIDS:
      return {
        ...state,
        ...payload,
      };
    case SET_BIDS_FILTER:
      return {
        ...state,
        filter: payload,
      };
    default:
      return state;
  }
}
