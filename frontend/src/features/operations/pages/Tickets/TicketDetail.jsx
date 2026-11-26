import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, MessageSquare, UserRound, RefreshCw } from "lucide-react";
import { opsApi } from "../../services/opsApi";
import "./TicketDetail.css";

const STATUSES = ["Open", "In Progress", "Waiting on Customer", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES = ["General", "Technical", "Billing", "Delivery"];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [note, setNote] = useState("");
  const [shownId, setShownId] = useState(id);

  if (id !== shownId) {
    setShownId(id);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    let active = true;
    Promise.allSettled([opsApi.getTicket(id), opsApi.listStaff({ limit: 100 })]).then(([ticketResult, staffResult]) => {
      if (!active) return;
      if (ticketResult.status === "fulfilled") { setTicket(ticketResult.value.data); setError(""); }
      else { setTicket(null); setError(ticketResult.reason?.message || "Unable to load ticket."); }
      if (staffResult.status === "fulfilled") setStaff(staffResult.value.data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  async function updateField(field, value) {
    if (saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await opsApi.updateTicket(id, { [field]: value });
      setTicket(response.data);
      setSuccess("Ticket updated successfully.");
    } catch (err) { setError(err.message || "Unable to update ticket."); }
    finally { setSaving(false); }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim() || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await opsApi.addNote(id, { text: note.trim(), isInternal: true });
      const response = await opsApi.getTicket(id);
      setTicket(response.data);
      setNote("");
      setSuccess("Internal note added.");
    } catch (err) { setError(err.message || "Unable to add note."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="ops-ticket-detail-message">Loading ticket details...</div>;
  if (!ticket) return <div className="ops-ticket-detail-message"><h2>Ticket unavailable</h2><p>{error || "Ticket not found."}</p><Link to="/operations/tickets">Back to Support Tickets</Link></div>;

  const assignedId = typeof ticket.assignedTo === "object" ? ticket.assignedTo?._id || "" : ticket.assignedTo || "";
  const categoryOptions = CATEGORIES.includes(ticket.category) ? CATEGORIES : [...CATEGORIES, ticket.category].filter(Boolean);
  return (
    <div className="ops-ticket-detail-page">
      <Link className="ops-ticket-detail-back" to="/operations/tickets"><ArrowLeft size={17} /> Back to Support Tickets</Link>
      <header className="ops-ticket-detail-header">
        <div><span className="ops-ticket-detail-number">TCK-{String(ticket.number ?? "—").padStart(4, "0")}</span><h1>{ticket.subject}</h1><div className="ops-ticket-detail-badges"><span className="ops-ticket-detail-badge">{ticket.status}</span><span className="ops-ticket-detail-badge">{ticket.priority} priority</span></div></div>
        <button type="button" className="ops-ticket-detail-refresh" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { const response = await opsApi.getTicket(id); setTicket(response.data); } catch (err) { setError(err.message || "Refresh failed."); } finally { setSaving(false); } }}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div role="alert" className="ops-ticket-detail-error">{error}</div>}
      {success && <div role="status" className="ops-ticket-detail-success">{success}</div>}
      <div className="ops-ticket-detail-actions">
        {!['Resolved','Closed'].includes(ticket.status) && <button type="button" disabled={saving} onClick={() => updateField("status", "Resolved")}><CheckCircle2 size={17} /> Mark Resolved</button>}
        {ticket.status === "Resolved" && <button type="button" disabled={saving} onClick={() => updateField("status", "Closed")}>Close Ticket</button>}
        {['Resolved','Closed'].includes(ticket.status) && <button type="button" disabled={saving} onClick={() => updateField("status", "Open")}>Reopen Ticket</button>}
      </div>
      <div className="ops-ticket-detail-grid">
        <main className="ops-ticket-detail-left">
          <section className="ops-ticket-detail-card"><h2>Description</h2><p className="ops-ticket-detail-description">{ticket.description || "No description provided."}</p></section>
          <section className="ops-ticket-detail-card"><h2><MessageSquare size={18} /> Notes & Activity</h2>
            <div className="ops-ticket-detail-notes">{ticket.notes?.length ? [...ticket.notes].reverse().map((item, index) => <article className="ops-ticket-detail-note" key={item._id || index}><div className="ops-ticket-detail-note-top"><strong>{item.createdBy?.name || item.authorName || "Operations Staff"}</strong><time>{formatDate(item.createdAt)}</time></div><p>{item.text || item.body || ""}</p>{item.isInternal && <small>Internal note</small>}</article>) : <p>No notes added yet.</p>}</div>
            <form className="ops-ticket-detail-note-form" onSubmit={addNote}><label htmlFor="ops-ticket-note">Add an internal note</label><textarea id="ops-ticket-note" value={note} maxLength={2000} rows={4} onChange={(e) => setNote(e.target.value)} placeholder="Write a ticket update..." /><button type="submit" disabled={saving || !note.trim()}>{saving ? "Saving..." : "Add Note"}</button></form>
          </section>
        </main>
        <aside className="ops-ticket-detail-right">
          <section className="ops-ticket-detail-card"><h2>Ticket Details</h2>
            <div className="ops-ticket-detail-field"><label htmlFor="ops-ticket-status">Status</label><select id="ops-ticket-status" disabled={saving} value={ticket.status || "Open"} onChange={(e) => updateField("status", e.target.value)}>{STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="ops-ticket-detail-field"><label htmlFor="ops-ticket-priority">Priority</label><select id="ops-ticket-priority" disabled={saving} value={ticket.priority || "Medium"} onChange={(e) => updateField("priority", e.target.value)}>{PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="ops-ticket-detail-field"><label htmlFor="ops-ticket-category">Category</label><select id="ops-ticket-category" disabled={saving} value={ticket.category || "General"} onChange={(e) => updateField("category", e.target.value)}>{categoryOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="ops-ticket-detail-field"><label htmlFor="ops-ticket-assignee">Assigned To</label><select id="ops-ticket-assignee" disabled={saving || !staff.length} value={assignedId} onChange={(e) => updateField("assignedTo", e.target.value || null)}><option value="">Unassigned</option>{assignedId && !staff.some((person) => person._id === assignedId) && <option value={assignedId}>{ticket.assignedTo?.name || "Current assignee"}</option>}{staff.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}</select>{!staff.length && <small>Staff list unavailable; assignment editing is disabled.</small>}</div>
          </section>
          <section className="ops-ticket-detail-card"><h2><UserRound size={18} /> Customer</h2><div className="ops-ticket-detail-info"><strong>{ticket.customer?.name || "—"}</strong><span>{ticket.customer?.company || "No company"}</span>{ticket.customer?.email && <a href={`mailto:${ticket.customer.email}`}>{ticket.customer.email}</a>}{ticket.customer?.phone && <a href={`tel:${ticket.customer.phone}`}>{ticket.customer.phone}</a>}</div></section>
          <section className="ops-ticket-detail-card"><h2><CalendarDays size={18} /> Timeline</h2><div className="ops-ticket-detail-timeline">{[["Created", ticket.createdAt],["Updated",ticket.updatedAt],["Resolved",ticket.resolvedAt],["Closed",ticket.closedAt]].map(([label, value]) => <p key={label}><span>{label}</span><strong>{formatDate(value)}</strong></p>)}</div></section>
        </aside>
      </div>
    </div>
  );
}
export default TicketDetail;
