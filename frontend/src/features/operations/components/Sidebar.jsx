import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  LifeBuoy,
  ClipboardList,
  BookOpen,
  Boxes,
  LogOut,
} from "lucide-react";

import "./Sidebar.css";

const navigationItems = [
  {
    label: "Dashboard",
    path: "/operations",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Support Tickets",
    path: "/operations/tickets",
    icon: LifeBuoy,
  },
  {
    label: "Work Orders",
    path: "/operations/work-orders",
    icon: ClipboardList,
  },
  {
    label: "Knowledge Base",
    path: "/operations/knowledge-base",
    icon: BookOpen,
  },
  {
    label: "Inventory & Assets",
    path: "/operations/assets",
    icon: Boxes,
  },
];

function Sidebar({ onLogout }) {
  return (
    <aside className="ops-sidebar">
      <div className="ops-sidebar-brand">
        <div className="ops-sidebar-logo">DH</div>

        <div className="ops-sidebar-brand-text">
          <div className="ops-sidebar-company">
            DevHub
          </div>
          <div className="ops-sidebar-powered">
            Powered by Cliently
          </div>
        </div>
      </div>

      <div className="ops-sidebar-content">
        <p className="ops-sidebar-section-title">
          NAVIGATION
        </p>

        <nav
          className="ops-sidebar-nav"
          aria-label="Operations navigation"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `ops-sidebar-nav-item ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <Icon
                  size={19}
                  className="ops-sidebar-nav-icon"
                />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="ops-sidebar-bottom">
        <button
          type="button"
          className="ops-sidebar-logout"
          onClick={onLogout}
        >
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
