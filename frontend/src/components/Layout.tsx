import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { WalletButton } from './WalletButton';

interface NavItem {
  to: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/browse', label: 'Examine' },
  { to: '/library', label: 'Library' },
  { to: '/mint', label: 'Mint' },
  { to: '/my-items', label: 'My Cells' },
  { to: '/rules', label: 'Rules' },
];

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the drawer whenever the route changes — otherwise it stays open
  // after tap-through to a new page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <>
      <div className="hex-bg" />
      <header className="header">
        <div className="header-inner">
          <NavLink to="/browse" className="logo">
            CellSwap
          </NavLink>

          <nav className="nav-tabs nav-tabs-desktop">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-right">
            <WalletButton />
            <button
              type="button"
              className="nav-burger"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div
          className="nav-drawer-scrim"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`nav-drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-tab nav-tab-drawer ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <span>CellSwap — built on Nervos CKB</span>
        <div className="footer-links">
          <NavLink to="/rules">Rules</NavLink>
          <NavLink to="/library">Library</NavLink>
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
