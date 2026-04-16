import { ccc } from '@ckb-ccc/connector-react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Browse } from './components/Browse';
import { ItemDetail } from './components/ItemDetail';
import { Mint } from './components/Mint';
import { MyItems } from './components/MyItems';
import { Rules } from './components/Rules';
import { Library } from './components/Library';
// JoyID passes the icon URL through its sign-request query string to
// testnet.joyid.dev / app.joy.id, so a data URL hits Cloudflare's URL length
// limit (URI_TOO_LONG). Point at the deployed cellswap.xyz asset — JoyID's
// iframe can fetch it regardless of whether we're running on localhost or prod.
const JOYID_ICON = 'https://cellswap.xyz/brand/cellswap-joyid.png';

export default function App() {
  return (
    <ccc.Provider name="CellSwap" icon={JOYID_ICON}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/browse" element={<Browse />} />
            <Route path="/item/:outpoint" element={<ItemDetail />} />
            <Route path="/mint" element={<Mint />} />
            <Route path="/my-items" element={<MyItems />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/library" element={<Library />} />
            <Route path="*" element={<Navigate to="/browse" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ccc.Provider>
  );
}
