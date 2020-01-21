import walletClient from '../utils/walletClient';
import { SET_PENDING_TRANSACTIONS } from './walletActions';

const FETCH_MY_NAMES_START = 'app/myDomains/fetchMyNamesStart';
const FETCH_MY_NAMES_STOP = 'app/myDomains/fetchMyNamesStop';

const EMPTY_OWNER_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const initialState = {
  names: [],
  isFetching: false,
  errorMessage: '',
};

export const getMyNames = () => async (dispatch, getState) => {
  const {address} = getState().wallet;

  dispatch({type: FETCH_MY_NAMES_START});

  try {
    const result = await walletClient.getNames();
    const ret = [];

    if (address) {
      await Promise.all(result.map(async domain => {
        const {owner} = domain;
        const coin = await walletClient.getCoin(owner.hash, owner.index);
        if (coin && domain.state === 'CLOSED') {
          ret.push(domain);
        }
      }));
    }

    dispatch({
      type: FETCH_MY_NAMES_STOP,
      payload: ret,
    });
  } catch (error) {
    dispatch({
      type: FETCH_MY_NAMES_STOP,
      payload: new Error(error.message),
      error: true,
    });
  }


};

export default function myDomainsReducer(state = initialState, action) {
  const {type, payload, error} = action;
  switch (type) {
    case FETCH_MY_NAMES_START:
      return {...state, isFetching: true};
    case FETCH_MY_NAMES_STOP:
      return error
        ? {...state, isFetching: false, errorMessage: error.message}
        : {...state, isFetching: false, names: payload};
    default:
      return state;
  }
}

function getMockNames(ownAddress) {
  return [
    {
      'name': 'megatest',
      'nameHash': '27b118c11562ebb2b11d94bbc1f23f3d78daea533766d929d39b580a2d37d4a4',
      'state': 'CLOSED',
      'height': 189,
      'renewal': 398,
      'owner': {
        'hash': ownAddress,
        'index': 0,
      },
      'value': 1000000,
      'highest': 3000000,
      'data': '00000000',
      'transfer': 0,
      'revoked': 0,
      'claimed': false,
      'weak': false,
      'stats': {
        'renewalPeriodStart': 398,
        'renewalPeriodEnd': 10398,
        'blocksUntilExpire': 9917,
        'daysUntilExpire': 34.43,
      },
    },
    {
      'name': 'trees',
      'nameHash': '92ec68524dbcc44bc3ff4847ed45e3a86789009d862499ce558c793498413cec',
      'state': 'CLOSED',
      'height': 67,
      'renewal': 276,
      'owner': {
        'hash': ownAddress,
        'index': 0,
      },
      'value': 5000000,
      'highest': 20000000,
      'data': '000a8c000906036e7331076578616d706c6503636f6d00010203040000000000000000000000000000000000',
      'transfer': 0,
      'revoked': 0,
      'claimed': false,
      'weak': false,
      'stats': {
        'renewalPeriodStart': 276,
        'renewalPeriodEnd': 10276,
        'blocksUntilExpire': 9795,
        'daysUntilExpire': 34.01,
      },
    },
    {
      'name': 'tba',
      'nameHash': 'a73f93785b1fc9b1973579cf2b3f1a08a832d462a5e8ad6e5ec75883ccd90f50',
      'state': 'CLOSED',
      'height': 434,
      'renewal': 477,
      'owner': {
        'hash': 'ded558796b20bead377c618c76641de0560dc4323a4b24d4131e7434d3077509',
        'index': 0,
      },
      'value': 0,
      'highest': 1000000,
      'data': '00000000',
      'transfer': 0,
      'revoked': 0,
      'claimed': false,
      'weak': false,
      'stats': {
        'renewalPeriodStart': 477,
        'renewalPeriodEnd': 10477,
        'blocksUntilExpire': 9996,
        'daysUntilExpire': 34.71,
      },
    },
  ];
}
