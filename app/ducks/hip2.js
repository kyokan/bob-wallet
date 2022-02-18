import hip2Client from '../utils/hip2Client';
import { SET_HIP2_PORT } from "./hip2Reducer";

export const init = () => async (dispatch) => {
  dispatch({
    type: SET_HIP2_PORT,
    payload: await hip2Client.getPort()
  })
}