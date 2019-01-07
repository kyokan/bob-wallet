import * as walletClient from '../utils/walletClient';

const SET_YOUR_BIDS = 'app/bids/setYourBids';

const initialState = {
  yourBids: [],
};

export const getYourBids = () => async (dispatch, getState) => {
  const net = getState().wallet.network;
  const wClient = walletClient.forNetwork(net);

  let result = await wClient.getBids();

  // result = [
  //   {
  //     "name": "megatest",
  //     "nameHash": "27b118c11562ebb2b11d94bbc1f23f3d78daea533766d929d39b580a2d37d4a4",
  //     "prevout": {
  //       "hash": "044aef8c1e61a3975bfa75dc9d6e1b19ce231ffcc019f97049543b2e12a692a6",
  //       "index": 0
  //     },
  //     "value": 3000000,
  //     "lockup": 4000000,
  //     "blind": "0ddd08f20581b7adadf881b80c5d044b17cf6b1965bf4c56815cca390d9c41db",
  //     "own": true
  //   },
  //   {
  //     "name": "megatest",
  //     "nameHash": "92ec68524dbcc44bc3ff4847ed45e3a86789009d862499ce558c793498413cec",
  //     "prevout": {
  //       "hash": "9ae840429110809efde0f0743178ce2f66d021a3c9c875f486293f132e37151f",
  //       "index": 0
  //     },
  //     "value": 5000000,
  //     "lockup": 10000000,
  //     "blind": "a0943b12aa57ec0b3e6371be5b75cc895d0f78a7c5367c065bd388aebe6051a5",
  //     "own": true
  //   }
  // ];

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
