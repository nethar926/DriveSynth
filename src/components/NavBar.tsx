import { NavLink } from 'react-router-dom';

const links = [
  { to: '/drive', label: 'Drive' },
  { to: '/cockpit', label: 'Cockpit' },
  { to: '/engines', label: 'Engines' },
  { to: '/customize', label: 'Customize' },
  { to: '/builder', label: 'Builder' },
  { to: '/diag', label: 'Diag' },
];

export function NavBar() {
  return (
    <nav className="nav-bar" aria-label="Main">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
