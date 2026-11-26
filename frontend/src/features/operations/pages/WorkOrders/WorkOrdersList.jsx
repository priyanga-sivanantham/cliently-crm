import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Search, Plus, FilterX, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { opsApi } from "../../services/opsApi";
import NewWorkOrderModal from "./NewWorkOrderModal";
import "./WorkOrdersList.css";

const STATUSES = ["Planned", "In Progress", "On Hold", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const COLORS = {
  Planned: ["#eaf6f3", "#123c3a"],
  "In Progress": ["#e6f3ff", "#2164a1"],
  "On Hold": ["#fff4df", "#946315"],
  Completed: ["#e5f5e9", "#227244"],
  Cancelled: ["#edf2f1", "#47635f"],
  Low: ["#eaf6ec", "#30754b"],
  Medium: ["#fff3d9", "#946315"],
  High: ["#fff0ef", "#ad4036"],
  Urgent: ["#fff0ef", "#ad4036"],
};

function Badge({ value }) {
  const [backgroundColor, color] = COLORS[value] || ["#edf2f1", "#47635f"];
  return <span className="ops-wo-badge" style={{ backgroundColor, color }}>{value || "—"}</span>;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function WorkOrdersList() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const priority = params.get("priority") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [searchText, setSearchText] = useState(q);
  const [workOrders, setWorkOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastQ, setLastQ] = useState(q);

  if (q !== lastQ) {
    setLastQ(q);
    setSearchText(q);
  }

  const updateParam = useCallback((key, value) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      return next;
    });
  }, [setParams]);

  useEffect(() => {
    if (searchText.trim() === q) return;
    const timer = setTimeout(() => updateParam("q", searchText.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchText, q, updateParam]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await opsApi.listWorkOrders({ q, status, priority, page, limit: 20 });
        if (!active) return;
        setWorkOrders(Array.isArray(response?.data) ? response.data : []);
        setPagination(response?.pagination || null);
      } catch (err) {
        if (active) setError(err?.message || "Unable to load work orders.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [q, status, priority, page, refreshKey]);

  async function handleCreateWorkOrder(payload) {
    // Existing modal supplies the payload; the API call is performed here.
    await opsApi.createWorkOrder(payload);
    setShowCreateModal(false);
    setParams({});
    setRefreshKey(current => current + 1);
  }

  function clearFilters() {
    setSearchText("");
    setParams({});
  }

  function changePage(nextPage) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("page", String(nextPage));
      return next;
    });
  }

  const hasFilters = Boolean(q || status || priority);
  return (
    <div className="ops-workorders-page">
      <header className="ops-wo-heading">
        <div>
          <span className="ops-wo-eyebrow">OPERATIONS CENTER</span>
          <h1>Work Orders</h1>
          <p>Manage, assign, and track operational work.</p>
        </div>
        <div className="ops-wo-heading-actions">
          <button type="button" className="ops-wo-refresh" disabled={loading} onClick={() => setRefreshKey(x => x + 1)}><RefreshCw size={16} /> Refresh</button>
          <button type="button" className="ops-wo-create" onClick={() => setShowCreateModal(true)}><Plus size={17} /> New Work Order</button>
        </div>
      </header>

      <section className="ops-wo-filters" aria-label="Work order filters">
        <div className="ops-wo-search"><Search size={18} /><input type="search" aria-label="Search work orders" placeholder="Search work orders..." value={searchText} onChange={event => setSearchText(event.target.value)} /></div>
        <select aria-label="Filter by status" value={status} onChange={event => updateParam("status", event.target.value)}><option value="">All statuses</option>{STATUSES.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="Filter by priority" value={priority} onChange={event => updateParam("priority", event.target.value)}><option value="">All priorities</option>{PRIORITIES.map(item => <option key={item} value={item}>{item}</option>)}</select>
        {hasFilters && <button type="button" className="ops-wo-clear" onClick={clearFilters}><FilterX size={16} /> Clear filters</button>}
      </section>

      <section className="ops-wo-table-wrap">
        <div className="ops-wo-table-header"><div><h2>Work Order Overview</h2><p>Track your team's operational tasks</p></div><span className="ops-wo-count">{pagination?.total ?? workOrders.length} Orders</span></div>
        {loading ? <div className="ops-wo-message">Loading work orders...</div> : error ? <div className="ops-wo-message ops-wo-error" role="alert">{error} <button type="button" onClick={() => setRefreshKey(x => x + 1)}>Retry</button></div> : workOrders.length === 0 ? (
          <div className="ops-wo-empty"><ClipboardList size={34} /><h3>No work orders found</h3><p>{hasFilters ? "Try adjusting your search or filters." : "Work orders will appear here when available."}</p>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>
        ) : (
          <div className="ops-wo-table-scroll"><table className="ops-wo-table"><thead><tr><th>Work Order</th><th>Title</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Due Date</th><th>Created</th></tr></thead><tbody>
            {workOrders.map(order => <tr key={order._id}><td className="ops-wo-number"><Link to={`/operations/work-orders/${order._id}`} className="ops-wo-detail-link">{order.number == null ? "WO" : `WO-${String(order.number).padStart(4, "0")}`}</Link></td><td className="ops-wo-subject"><Link to={`/operations/work-orders/${order._id}`} className="ops-wo-title-link">{order.title || "Untitled"}</Link></td><td><Badge value={order.priority} /></td><td><Badge value={order.status} /></td><td>{order.assignedTo?.name || "Unassigned"}</td><td>{formatDate(order.dueDate)}</td><td>{formatDate(order.createdAt)}</td></tr>)}
          </tbody></table></div>
        )}
        {pagination && pagination.pages > 1 && <div className="ops-wo-pagination"><span>Page {pagination.page} of {pagination.pages}</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => changePage(page - 1)}><ChevronLeft size={16} /> Previous</button><button type="button" disabled={page >= pagination.pages || loading} onClick={() => changePage(page + 1)}>Next <ChevronRight size={16} /></button></div></div>}
      </section>
      {showCreateModal && <NewWorkOrderModal onClose={() => setShowCreateModal(false)} onCreated={handleCreateWorkOrder} />}
    </div>
  );
}
export default WorkOrdersList;
