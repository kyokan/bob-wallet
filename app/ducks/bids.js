import walletClient from '../utils/walletClient';

const SET_YOUR_BIDS = 'app/bids/setYourBids';

const initialState = {
  yourBids: [],
};

export const setYourBids = (bids = []) => ({
  type: SET_YOUR_BIDS,
  payload: bids,
});

export const getYourBids = () => async (dispatch) => {
  const result = await walletClient.getBids();

  const yourBids = result.filter(({ own }) => own);

  if (result && result.length) {
    dispatch(setYourBids(yourBids));
  }
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
