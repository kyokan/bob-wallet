import walletClient from '../utils/walletClient';
import {fetchName} from "./names";

const SET_YOUR_BIDS = 'app/bids/setYourBids';

const initialState = {
  yourBids: [],
};

export const getYourBids = () => async (dispatch) => {
  const result = await walletClient.getBids();

  if (result && result.length) {
    dispatch({
      type: SET_YOUR_BIDS,
      payload: result,
    });
  }

  // setTimeout(async () => {
  //   for (let bid of result) {
  //     await dispatch(fetchName(bid.name));
  //   }
  // }, 0);
};

export default function bidsReducer(state = initialState, action) {
  const {type, payload} = action;

  switch (type) {
    case SET_YOUR_BIDS:
      return {...state, yourBids: payload};
    default:
      return state;
  }
}
