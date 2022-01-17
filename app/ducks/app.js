import settingsClient from "../utils/settingsClient";

const SET_DEEPLINK = 'app/setDeeplink';
const SET_LOCALE = 'app/setLocale';
const SET_DEEPLINK_PARAMS = 'app/setDeeplinkParams';

const initialState = {
  deeplink: '',
  deeplinkParams: {},
  locale: '',
};

export const fetchLocale = () => async dispatch => {
  const locale = await settingsClient.getLocale();
  dispatch(setLocale(locale));
};

export const setLocale = locale => async (dispatch) => {
  await settingsClient.setLocale(locale);
  dispatch({
    type: SET_LOCALE,
    payload: locale,
  });
};

export const setDeeplink = url => ({
  type: SET_DEEPLINK,
  payload: url,
});

export const clearDeeplink = () => ({
  type: SET_DEEPLINK,
  payload: '',
});

export const setDeeplinkParams = params => ({
  type: SET_DEEPLINK_PARAMS,
  payload: params,
});

export const clearDeeplinkParams = () => ({
  type: SET_DEEPLINK_PARAMS,
  payload: {},
});

export default function appReducer(state = initialState, action) {
  switch (action.type) {
    case SET_DEEPLINK:
      return {
        ...state,
        deeplink: action.payload,
      };
    case SET_DEEPLINK_PARAMS:
      return {
        ...state,
        deeplinkParams: action.payload,
      };
    case SET_LOCALE:
      return {
        ...state,
        locale: action.payload,
      };
    default:
      return state;
  }
}
