import walletClient from '../utils/walletClient';

const FETCH_MY_NAMES_START = 'app/myDomains/fetchMyNamesStart';
const FETCH_MY_NAMES_STOP = 'app/myDomains/fetchMyNamesStop';

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
