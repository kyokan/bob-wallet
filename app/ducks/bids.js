import * as walletClient from '../utils/walletClient';

const SET_YOUR_BIDS = 'app/bids/setYourBids';

const initialState = {
  yourBids: [],
};

export const getYourBids = () => async (dispatch, getState) => {
  const net = getState().node.network;
  const wClient = walletClient.forNetwork(net);
  const result = await wClient.getBids();

  if (result && result.length) {
    dispatch({
      type: SET_YOUR_BIDS,
      payload: result,
    });
  }
};

export default function bidsReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case SET_YOUR_BIDS:
      return { ...state, yourBids: payload };
    default:
      return state;
  }
}
