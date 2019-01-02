const SET_NAME = 'app/names/setName';

const API = 'http://127.0.0.1:15037';
const initialState = {};

export const getNameInfo = name => async dispatch => {
  const resp = await fetch(API, {
    method: 'POST',
    body: JSON.stringify({
      method: 'getnameinfo',
      params: [ name ],
    }),
  });
  const { result, error } = await resp.json();

  if (error) {
    const err = new Error(error.message);
    dispatch({
      type: SET_NAME,
      error: err,
      payload: {
        name,
        result: null,
      }
    });
    throw err;
  }

  dispatch({
    type: SET_NAME,
    payload: { name, result },
  });
};

export default function namesReducer(state = initialState, action) {
  const { type, payload, error } = action;
  switch (type) {
    case SET_NAME:
      return { ...state, [payload.name]: payload.result };
    default:
      return state;
  }
};
