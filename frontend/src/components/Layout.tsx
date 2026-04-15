import { NavLink, Outlet } from 'react-router-dom';
import { WalletButton } from './WalletButton';

export function Layout() {
  return (
    <>
      <div className="hex-bg" />
      <header className="header">
        <div className="header-inner">
          <NavLink to="/browse" className="logo">
            CellSwap
          </NavLink>
          <nav className="nav-tabs">
            <NavLink to="/browse" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              Examine
            </NavLink>
            <NavLink to="/mint" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              Mint
            </NavLink>
            <NavLink to="/my-items" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              My Cells
            </NavLink>
            <NavLink to="/rules" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              Rules
            </NavLink>
          </nav>
          <WalletButton />
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <span>CellSwap — built on Nervos CKB</span>
        <div className="footer-links">
          <NavLink to="/rules">Rules</NavLink>
          <a href="https://github.com/toastmanAu/ckb-cell-marketplace" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://docs.nervos.org" target="_blank" rel="noreferrer">CKB Docs</a>
          <a href="https://testnet.explorer.nervos.org" target="_blank" rel="noreferrer">Explorer</a>
          <span style={{ opacity: 0.6, fontFamily: 'monospace', fontSize: '.75rem' }}>
            build {__BUILD_ID__}
          </span>
        </div>
      </footer>
    </>
  );
}
