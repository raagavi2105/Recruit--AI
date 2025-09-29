import { NextApiRequest, NextApiResponse } from 'next';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import rootReducer from '../../src/store';
import { persistStore } from 'redux-persist';

const store = createStore(rootReducer);
const persistor = persistStore(store);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ message: 'API is working', store, persistor });
}