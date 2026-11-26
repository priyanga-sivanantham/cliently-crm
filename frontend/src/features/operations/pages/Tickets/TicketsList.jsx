import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Ticket, Plus, ChevronLeft, ChevronRight, FilterX, RefreshCw, AlertTriangle, UserCheck, Inbox } from "lucide-react";
import { opsApi } from "../../services/opsApi";
import NewTicketModal from "./NewTicketModal";
import "./TicketsList.css";

const STATUSES = ["Open", "In Progress", "Waiting on Customer", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES = ["General", "Technical", "Billing", "Delivery"];
const BADGE_COLORS = {
  Open: ["#eaf6f3", "#176d62"], "In Progress": ["#e6f0ff", "#1d4ed8"],
  "Waiting on Customer": ["#fff4e5", "#b45309"], Resolved: ["#e7f7ee", "#15803d"],
  Closed: ["#f1f3f3", "#637875"], Low: ["#f1f3f3", "#637875"],
  Medium: ["#e6f0ff", "#1d4ed8"], High: ["#fff4e5", "#b45309"],
  Urgent: ["#fdecec", "#b91c1c"],
};

function TicketBadge({ value }) {
  const [background, color] = BADGE_COLORS[value] || ["#f1f3f3", "#637875"];
  return <span className="ops-ticket-badge" style={{ backgroundColor: background, color }}>{value || "—"}</span>;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTicketId(ticket) {
  if (ticket.number === undefined || ticket.number === null) return "Ticket";
  const number = String(ticket.number);
  return number.startsWith("TCK-") ? number : `TCK-${number.padStart(4, "0")}`;
}

function getTicketId(ticket) {
  return ticket._id || ticket.id;
}

function isEscalated(ticket) {
  return ticket.isEscalated === true || ticket.escalated === true ||
    String(ticket.escalationStatus || "").toLowerCase() === "escalated";
}

export default function TicketsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";
  const category = searchParams.get("category") || "";
  const assignedTo = searchParams.get("assignedTo") || "";
  const sort = searchParams.get("sort") || "newest";
  const view = searchParams.get("view") || "all";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [searchText, setSearchText] = useState(q);
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [lastQ, setLastQ] = useState(q);

  if (q !== lastQ) {
    setLastQ(q);
    setSearchText(q);
  }
  function updateParams(changes) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    next.delete("page");
    setSearchParams(next);
  }

  useEffect(() => {
    if (searchText.trim() === q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (searchText.trim()) next.set("q", searchText.trim());
      else next.delete("q");
      next.delete("page");
      setSearchParams(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText, q, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    async function loadTickets() {
      setLoading(true);
      setError("");
      try {
        const effectiveAssignedTo = view === "mine" ? "me" : view === "unassigned" ? "unassigned" : assignedTo;
        const response = await opsApi.listTickets({ q, status, priority, category, assignedTo: effectiveAssignedTo, sort, page, limit: 20 });
        if (!active) return;
        const records = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
        setTickets(records);
        setPagination(response?.pagination || null);
      } catch (err) {
        if (active) {
          setTickets([]);
          setPagination(null);
          setError(err?.message || "Unable to load tickets.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTickets();
    return () => { active = false; };
  }, [q, status, priority, category, assignedTo, sort, page, view, refreshKey]);

  const visibleTickets = view === "escalated" ? tickets.filter(isEscalated) : tickets;
  const hasFilters = Boolean(q || status || priority || category || assignedTo || view !== "all");
  const total = pagination?.total ?? tickets.length;
  const pages = pagination?.pages ?? 1;
  const currentPage = pagination?.page ?? page;

  function changePage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  function selectView(nextView) {
    updateParams({ view: nextView === "all" ? "" : nextView, assignedTo: "" });
  }

  function clearFilters() {
    setSearchText("");
    setSearchParams({});
  }

  return (
    <div className="ops-tickets-page">
      <header className="ops-tickets-heading">
        <div>
          <div className="ops-tickets-title-row"><span className="ops-tickets-title-icon"><Ticket size={22} /></span><div><span className="ops-tickets-eyebrow">OPERATIONS / SUPPORT</span><h1>Support Tickets</h1></div></div>
          <p>Manage customer requests, assignments, priorities and resolutions.</p>
        </div>
        <div className="ops-tickets-header-actions">
          <button type="button" className="ops-tickets-refresh" onClick={() => setRefreshKey(v => v + 1)} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          <button type="button" className="ops-tickets-create" onClick={() => setShowNewTicket(true)}><Plus size={17} /> New Ticket</button>
        </div>
      </header>

      <nav className="ops-tickets-view-tabs" aria-label="Ticket views">
        {[
          { key: "all", label: "All Tickets", icon: Inbox },
          { key: "mine", label: "Assigned to Me", icon: UserCheck },
          { key: "unassigned", label: "Unassigned", icon: Ticket },
          { key: "escalated", label: "Escalations", icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" className={view === key ? "active" : ""} aria-pressed={view === key} onClick={() => selectView(key)}><Icon size={16} /> {label}</button>
        ))}
      </nav>

      <section className="ops-tickets-filters" aria-label="Ticket filters">
        <label className="ops-tickets-search"><Search size={18} /><input type="search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search subject or customer..." aria-label="Search tickets" /></label>
        <select value={status} onChange={e => updateParams({ status: e.target.value })} aria-label="Filter by status"><option value="">All statuses</option>{STATUSES.map(v => <option key={v} value={v}>{v}</option>)}</select>
        <select value={priority} onChange={e => updateParams({ priority: e.target.value })} aria-label="Filter by priority"><option value="">All priorities</option>{PRIORITIES.map(v => <option key={v} value={v}>{v}</option>)}</select>
        <select value={category} onChange={e => updateParams({ category: e.target.value })} aria-label="Filter by category"><option value="">All categories</option>{CATEGORIES.map(v => <option key={v} value={v}>{v}</option>)}</select>
        {view === "all" && <select value={assignedTo} onChange={e => updateParams({ assignedTo: e.target.value })} aria-label="Filter by assignment"><option value="">All assignees</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option></select>}
        <select value={sort} onChange={e => updateParams({ sort: e.target.value })} aria-label="Sort tickets"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">By priority</option></select>
      </section>

      <div className="ops-tickets-status-tabs">
        {["", ...STATUSES].map(v => <button type="button" key={v || "all"} className={status === v ? "active" : ""} onClick={() => updateParams({ status: v })}>{v || "All Statuses"}</button>)}
        {hasFilters && <button type="button" className="ops-tickets-clear" onClick={clearFilters}><FilterX size={15} /> Clear filters</button>}
      </div>

      <section className="ops-tickets-table-wrap">
        <div className="ops-tickets-table-header"><div><h2>{view === "mine" ? "My Assigned Tickets" : view === "unassigned" ? "Unassigned Tickets" : view === "escalated" ? "Escalated Tickets" : "Ticket Inbox"}</h2><p>{view === "escalated" ? "Escalation records available in the current results" : "Customer support activity and assignment overview"}</p></div><span className="ops-tickets-count">{view === "escalated" ? visibleTickets.length : total} {view === "escalated" ? "Shown" : "Tickets"}</span></div>
        {view === "escalated" && <p className="ops-tickets-notice">Escalations are identified from escalation fields in the returned tickets. This view is limited to the current page until a dedicated escalation API/filter is available.</p>}
        {loading ? <div className="ops-tickets-message">Loading tickets...</div> : error ? <div className="ops-tickets-message ops-tickets-error" role="alert">{error} <button type="button" onClick={() => setRefreshKey(v => v + 1)}>Retry</button></div> : visibleTickets.length === 0 ? <div className="ops-tickets-empty"><Ticket size={32} /><h3>No tickets found</h3><p>{view === "escalated" ? "No escalated tickets were identified in these results." : "Try changing the filters or create a new ticket."}</p>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div> : (
          <div className="ops-tickets-table-scroll"><table className="ops-tickets-table"><thead><tr><th>Ticket</th><th>Customer</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Created</th><th>Action</th></tr></thead><tbody>{visibleTickets.map((ticket, index) => {
            const id = getTicketId(ticket);
            const assignee = ticket.assignedTo?.name || (typeof ticket.assignedTo === "string" ? ticket.assignedTo : "");
            return <tr key={id || `${ticket.number}-${index}`}><td><div className="ops-ticket-main">{id ? <Link to={`/operations/tickets/${id}`} className="ops-ticket-number">{formatTicketId(ticket)}</Link> : <strong className="ops-ticket-number">{formatTicketId(ticket)}</strong>}<span className="ops-ticket-subject">{ticket.subject || "Untitled ticket"}</span></div></td><td><div className="ops-ticket-customer"><strong>{ticket.customer?.name || "—"}</strong><small>{ticket.customer?.company || ""}</small></div></td><td><TicketBadge value={ticket.priority} /></td><td><TicketBadge value={ticket.status} /></td><td>{assignee ? <div className="ops-ticket-assignee"><span className="ops-ticket-avatar">{assignee.charAt(0).toUpperCase()}</span><span>{assignee}</span></div> : <span className="ops-ticket-unassigned">Unassigned</span>}</td><td className="ops-ticket-date">{formatDate(ticket.createdAt)}</td><td>{id ? <Link className="ops-ticket-view" to={`/operations/tickets/${id}`}>View <ChevronRight size={14} /></Link> : "—"}</td></tr>;
          })}</tbody></table></div>
        )}
        {pages > 1 && <div className="ops-tickets-pagination"><span>Page {currentPage} of {pages}</span><div><button type="button" disabled={loading || currentPage <= 1} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={16} /> Previous</button><button type="button" disabled={loading || currentPage >= pages} onClick={() => changePage(currentPage + 1)}>Next <ChevronRight size={16} /></button></div></div>}
      </section>
      {showNewTicket && <NewTicketModal onClose={() => setShowNewTicket(false)} onCreated={() => { setShowNewTicket(false); setRefreshKey(v => v + 1); }} />}
    </div>
  );
}
