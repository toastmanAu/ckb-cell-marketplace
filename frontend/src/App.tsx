import { ccc } from '@ckb-ccc/connector-react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Browse } from './components/Browse';
import { ItemDetail } from './components/ItemDetail';
import { Mint } from './components/Mint';
import { MyItems } from './components/MyItems';

export default function App() {
  return (
    <ccc.Provider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/browse" element={<Browse />} />
            <Route path="/item/:outpoint" element={<ItemDetail />} />
            <Route path="/mint" element={<Mint />} />
            <Route path="/my-items" element={<MyItems />} />
            <Route path="*" element={<Navigate to="/browse" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ccc.Provider>
  );
}
