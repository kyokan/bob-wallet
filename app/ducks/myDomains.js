import walletClient from '../utils/walletClient';

const FETCH_MY_NAMES_START = 'app/myDomains/fetchMyNamesStart';
const FETCH_MY_NAMES_STOP = 'app/myDomains/fetchMyNamesStop';
const ADD_NAME = 'app/myDomains/addName';
const ADD_NAMES = 'app/myDomains/addNames';
const SET_NAMES = 'app/myDomains/setNames';

const initialState = {
  names: {},
  isFetching: false,
  errorMessage: '',
};

export const setNames = (names = {}) => ({
  type: SET_NAMES,
  payload: names,
});

export const getMyNames = () => async (dispatch, getState) => {
  const {
    myDomains: {
      isFetching,
    },
  } = getState();

  if (isFetching) return;

  dispatch({ type: FETCH_MY_NAMES_START });

  try {
    const result = await walletClient.getNames();
    let ret = {};
    let len = 0;

    for (let i = 0; i < result.length; i++) {
      const domain = result[i];
      const {owner, name} = domain;

      const coin = await walletClient.getCoin(owner.hash, owner.index);
      if (coin) {
        ret[name] = domain;
        len++;
      }
    }

    dispatch({
      type: SET_NAMES,
      payload: ret,
    });

    dispatch({ type: FETCH_MY_NAMES_STOP });

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
      return {
        ...state,
        isFetching: true,
        errorMessage: '',
      };
    case FETCH_MY_NAMES_STOP:
      return error
        ? {
          ...state,
          isFetching: false,
          errorMessage: error.message,
        }
        : {
          ...state,
          isFetching: false,
          errorMessage: '',
        };
    case SET_NAMES:
      return {
        ...state,
        names: payload,
      };
    case ADD_NAMES:
      return {
        ...state,
        names: {
          ...state.names,
          ...payload,
        },
      };
    case ADD_NAME:
      return {
        ...state,
        names: {
          ...state.names,
          [payload.name]: payload,
        },
      };
    default:
      return state;
  }
}
