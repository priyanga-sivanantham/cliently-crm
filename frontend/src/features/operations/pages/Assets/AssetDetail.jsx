import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Pencil,
  Trash2,
  Plus,
  Minus,
  Loader2,
  AlertTriangle,
  UserRound,
  CalendarDays,
  MapPin,
  Boxes,
  X,
  Save,
  RotateCcw,
} from "lucide-react";

import { opsApi } from "../../services/opsApi";
import "./AssetDetail.css";

const TYPES = ["Hardware", "Software", "License", "Consumable"];
const STATUSES = ["In Stock", "In Repair", "Retired"];

const dateFormat = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const dateInput = (value) =>
  value ? String(value).slice(0, 10) : "";

const currency = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })}`;

const initialEdit = (asset) => ({
  name: asset.name || "",
  type: asset.type || "",
  code: asset.code || "",
  category: asset.category || "",
  unit: asset.unit || "pcs",
  reorderLevel: String(asset.reorderLevel ?? 0),
  status: asset.status === "Assigned" ? "" : asset.status || "In Stock",
  serialNumber: asset.serialNumber || "",
  location: asset.location || "",
  cost: asset.cost == null ? "" : String(asset.cost),
  purchaseDate: dateInput(asset.purchaseDate),
  warrantyUntil: dateInput(asset.warrantyUntil),
  productId: asset.productId?._id || "",
  notes: asset.notes || "",
});

async function fetchAsset(id) {
  try {
    const response = await opsApi.getAsset(id);
    const result = response?.data || response;
    const found = result && typeof result === "object" && result._id ? result : null;
    return { asset: found, notFound: !found, error: "" };
  } catch (err) {
    if (err?.status === 404) return { asset: null, notFound: true, error: "" };
    return { asset: null, notFound: false, error: err?.message || "Unable to load asset." };
  }
}

function AssetStatus({ status }) {
  const suffix = String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <span className={`ops-asset-detail-status ops-asset-detail-status-${suffix}`}>
      {status || "—"}
    </span>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const [stockAmount, setStockAmount] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const [workOrders, setWorkOrders] = useState([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [products, setProducts] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [editError, setEditError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shownId, setShownId] = useState(id);

  if (id !== shownId) {
    setShownId(id);
    setAsset(null);
    setLoading(true);
    setError("");
    setNotFound(false);
  }

  const applyResult = useCallback((result) => {
    setAsset(result.asset);
    setNotFound(result.notFound);
    setError(result.error);
    setLoading(false);
  }, []);

  const loadAsset = useCallback(async () => {
    applyResult(await fetchAsset(id));
  }, [id, applyResult]);

  useEffect(() => {
    let active = true;
    fetchAsset(id).then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [id, applyResult]);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      try {
        const [ordersResponse, productsResponse] = await Promise.allSettled([
          opsApi.listWorkOrders({ limit: 100 }),
          typeof opsApi.listProducts === "function"
            ? opsApi.listProducts({ limit: 100 })
            : typeof opsApi.products === "function"
              ? opsApi.products()
              : Promise.resolve({ data: [] }),
        ]);

        if (!active) return;

        setWorkOrders(
          (ordersResponse.status === "fulfilled"
            ? (Array.isArray(ordersResponse.value?.data) ? ordersResponse.value.data : Array.isArray(ordersResponse.value) ? ordersResponse.value : [])
            : []).filter(
            (order) =>
              order.status !== "Completed" &&
              order.status !== "Cancelled"
          )
        );

        setProducts(productsResponse.status === "fulfilled"
          ? (Array.isArray(productsResponse.value?.data) ? productsResponse.value.data : Array.isArray(productsResponse.value) ? productsResponse.value : [])
          : []);
      } catch {
        if (active) {
          setWorkOrders([]);
          setProducts([]);
        }
      }
    }

    loadReferences();

    return () => {
      active = false;
    };
  }, []);

  async function performAction(action) {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await action();
      const updated = response?.data || response;
      if (updated && typeof updated === "object" && updated._id) {
        setAsset(updated);
      } else {
        await loadAsset();
      }
    } catch (err) {
      setError(err?.message || "Unable to update asset.");
    } finally {
      setBusy(false);
    }
  }

  function adjustStock(direction) {
    const amount = Number(stockAmount);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Enter a positive whole number to adjust stock.");
      return;
    }

    if (direction < 0 && amount > Number(asset?.quantity ?? 0)) {
      setError("Cannot remove more stock than is available.");
      return;
    }

    performAction(() =>
      opsApi.adjustStock(id, {
        change: direction * amount,
      })
    );
  }

  function assignAsset(event) {
    event.preventDefault();

    if (!customerName.trim() && !workOrderId) {
      setError("Enter a customer name or select a work order.");
      return;
    }

    performAction(async () => {
      const response = await opsApi.assignAsset(id, {
        ...(customerName.trim()
          ? { customerName: customerName.trim() }
          : {}),
        ...(workOrderId ? { workOrderId } : {}),
      });

      setCustomerName("");
      setWorkOrderId("");
      return response;
    });
  }

  function openEdit() {
    setEditForm(initialEdit(asset));
    setFieldErrors({});
    setEditError("");
    setEditOpen(true);
  }

  function changeEdit(name, value) {
    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (busy || !editForm) return;

    const errors = {};

    if (!editForm.name.trim()) errors.name = "Name is required.";
    if (!editForm.type) errors.type = "Type is required.";

    if (
      !Number.isSafeInteger(Number(editForm.reorderLevel)) ||
      Number(editForm.reorderLevel) < 0 ||
      editForm.reorderLevel === ""
    ) {
      errors.reorderLevel = "Enter a whole number of 0 or more.";
    }

    if (
      editForm.cost !== "" &&
      (!Number.isFinite(Number(editForm.cost)) ||
        Number(editForm.cost) < 0)
    ) {
      errors.cost = "Cost must be 0 or more.";
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setEditError("Please correct the highlighted fields.");
      return;
    }

    const body = {
      name: editForm.name.trim(),
      type: editForm.type,
      code: editForm.code.trim(),
      category: editForm.category.trim(),
      unit: editForm.unit.trim() || "pcs",
      reorderLevel: Number(editForm.reorderLevel),
      serialNumber: editForm.serialNumber.trim(),
      location: editForm.location.trim(),
      cost: editForm.cost === "" ? null : Number(editForm.cost),
      purchaseDate: editForm.purchaseDate || null,
      warrantyUntil: editForm.warrantyUntil || null,
      productId: editForm.productId || null,
      notes: editForm.notes.trim(),
    };

    if (asset.status !== "Assigned") {
      body.status = editForm.status;
    }

    setBusy(true);
    setEditError("");
    setFieldErrors({});

    try {
      const response = await opsApi.updateAsset(id, body);
      const updated = response?.data || response;
      if (updated && typeof updated === "object" && updated._id) {
        setAsset(updated);
      } else {
        await loadAsset();
      }
      setEditOpen(false);
    } catch (err) {
      setEditError(err?.message || "Unable to save changes.");
      setFieldErrors(err?.errors || {});
    } finally {
      setBusy(false);
    }
  }

  async function deleteAsset() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await opsApi.deleteAsset(id);
      navigate("/operations/assets");
    } catch (err) {
      setError(err?.message || "Unable to delete asset.");
      setDeleteOpen(false);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="ops-asset-detail">
        <div className="ops-asset-detail-state">
          <Loader2 className="ops-asset-detail-spin" size={30} />
          <p>Loading asset details...</p>
        </div>
      </div>
    );
  }

  if (notFound || !asset) {
    return (
      <div className="ops-asset-detail">
        <div className="ops-asset-detail-state">
          <Package size={40} />
          <h2>{notFound ? "Asset not found" : "Unable to show asset"}</h2>
          <p>
            {notFound
              ? "This asset doesn't exist or has been deleted."
              : error || "Please try again."}
          </p>
          <button onClick={() => navigate("/operations/assets")}>
            Back to Assets
          </button>
          {!notFound && (
            <button
              onClick={() => {
                setLoading(true);
                setError("");
                loadAsset();
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const assignment = asset.assignment;
  const warrantyExpired =
    asset.warrantyUntil &&
    dateInput(asset.warrantyUntil) <
      new Date().toLocaleDateString("sv-SE");

  return (
    <div className="ops-asset-detail">
      <button
        type="button"
        className="ops-asset-detail-back"
        onClick={() => navigate("/operations/assets")}
      >
        <ArrowLeft size={17} />
        Back to Inventory &amp; Assets
      </button>

      <header className="ops-asset-detail-header">
        <div>
          <div className="ops-asset-detail-eyebrow">
            <Boxes size={15} />
            ASSET INFORMATION
          </div>

          <h1>{asset.name}</h1>
          <p>{asset.code || "No asset code"} · {asset.type}</p>

          <div className="ops-asset-detail-badges">
            <AssetStatus status={asset.status} />
            {asset.lowStock && (
              <span className="ops-asset-detail-low">
                <AlertTriangle size={13} />
                Low stock
              </span>
            )}
          </div>
        </div>

        <div className="ops-asset-detail-actions">
          <button
            type="button"
            className="ops-asset-detail-edit-btn"
            onClick={openEdit}
            disabled={busy}
          >
            <Pencil size={16} />
            Edit
          </button>
          <button
            type="button"
            className="ops-asset-detail-delete-btn"
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </header>

      {error && (
        <div className="ops-asset-detail-error" role="alert">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}

      <div className="ops-asset-detail-layout">
        <div className="ops-asset-detail-main">
          <section className="ops-asset-detail-card">
            <h2><Package size={19} /> Stock Management</h2>

            <div className="ops-asset-detail-stock">
              <div>
                <span>Available Quantity</span>
                <strong>
                  {Number(asset.quantity ?? 0).toLocaleString("en-IN")}
                  <small> {asset.unit || "pcs"}</small>
                </strong>
              </div>

              <div>
                <span>Reorder Level</span>
                <strong>
                  {Number(asset.reorderLevel ?? 0).toLocaleString("en-IN")}
                </strong>
              </div>
            </div>

            <div className="ops-asset-detail-stock-controls">
              <label>
                Adjustment Quantity
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockAmount}
                  onChange={(event) => setStockAmount(event.target.value)}
                  disabled={busy}
                />
              </label>

              <button
                type="button"
                className="ops-asset-detail-add"
                disabled={busy}
                onClick={() => adjustStock(1)}
              >
                <Plus size={16} />
                Add Stock
              </button>

              <button
                type="button"
                className="ops-asset-detail-remove"
                disabled={busy}
                onClick={() => adjustStock(-1)}
              >
                <Minus size={16} />
                Remove Stock
              </button>
            </div>

            {asset.lowStock && (
              <p className="ops-asset-detail-stock-warning">
                <AlertTriangle size={15} />
                Stock has reached or fallen below the reorder level.
              </p>
            )}
          </section>

          <section className="ops-asset-detail-card">
            <h2><UserRound size={19} /> Asset Assignment</h2>

            {assignment ? (
              <div className="ops-asset-detail-assigned">
                <div className="ops-asset-detail-info-row">
                  <span>Customer</span>
                  <strong>{assignment.customerName || "—"}</strong>
                </div>

                <div className="ops-asset-detail-info-row">
                  <span>Work Order</span>
                  <strong>
                    {assignment.workOrderId?._id ? (
                      <Link
                        to={`/operations/work-orders/${assignment.workOrderId._id}`}
                      >
                        WO-{String(
                          assignment.workOrderId.number
                        ).padStart(4, "0")}{" "}
                        {assignment.workOrderId.title}
                      </Link>
                    ) : "—"}
                  </strong>
                </div>

                <div className="ops-asset-detail-info-row">
                  <span>Assigned Date</span>
                  <strong>{dateFormat(assignment.assignedAt)}</strong>
                </div>

                <button
                  type="button"
                  className="ops-asset-detail-unassign"
                  disabled={busy}
                  onClick={() =>
                    performAction(() => opsApi.unassignAsset(id))
                  }
                >
                  <RotateCcw size={16} />
                  Unassign / Return to Stock
                </button>
              </div>
            ) : asset.status === "Retired" ? (
              <p className="ops-asset-detail-muted">
                Retired assets cannot be assigned.
              </p>
            ) : (
              <form
                className="ops-asset-detail-assign-form"
                onSubmit={assignAsset}
              >
                <p>
                  Assign this asset to a customer, a work order, or both.
                </p>

                <label>
                  Customer Name
                  <input
                    value={customerName}
                    onChange={(event) =>
                      setCustomerName(event.target.value)
                    }
                    placeholder="e.g. ABC Corp"
                    disabled={busy}
                  />
                </label>

                <label>
                  Work Order
                  <select
                    value={workOrderId}
                    onChange={(event) =>
                      setWorkOrderId(event.target.value)
                    }
                    disabled={busy}
                  >
                    <option value="">Select work order (optional)</option>
                    {workOrders.map((order) => (
                      <option key={order._id} value={order._id}>
                        WO-{String(order.number).padStart(4, "0")} — {order.title}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  className="ops-asset-detail-primary"
                  disabled={busy || (!customerName.trim() && !workOrderId)}
                >
                  <UserRound size={16} />
                  Assign Asset
                </button>
              </form>
            )}
          </section>
        </div>

        <aside className="ops-asset-detail-sidebar">
          <section className="ops-asset-detail-card">
            <h2><Boxes size={19} /> Asset Details</h2>

            <div className="ops-asset-detail-info-row">
              <span>Category</span>
              <strong>{asset.category || "—"}</strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span>Serial Number</span>
              <strong>{asset.serialNumber || "—"}</strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span><MapPin size={14} /> Location</span>
              <strong>{asset.location || "—"}</strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span>Cost</span>
              <strong>{currency(asset.cost)}</strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span><CalendarDays size={14} /> Purchase Date</span>
              <strong>{dateFormat(asset.purchaseDate)}</strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span>Warranty Until</span>
              <strong className={warrantyExpired ? "ops-asset-detail-expired" : ""}>
                {dateFormat(asset.warrantyUntil)}
                {warrantyExpired ? " (Expired)" : ""}
              </strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span>Related Product</span>
              <strong>{asset.productId?.name || "—"}</strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span>Created</span>
              <strong>{dateFormat(asset.createdAt)}</strong>
            </div>

            <div className="ops-asset-detail-info-row">
              <span>Updated</span>
              <strong>{dateFormat(asset.updatedAt)}</strong>
            </div>
          </section>

          <section className="ops-asset-detail-card">
            <h2>Notes</h2>
            <p className="ops-asset-detail-notes">
              {asset.notes || "No additional notes."}
            </p>
          </section>
        </aside>
      </div>

      {editOpen && editForm && (
        <div className="ops-asset-detail-modal-overlay">
          <div
            className="ops-asset-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-edit-title"
          >
            <div className="ops-asset-detail-modal-header">
              <div>
                <h2 id="asset-edit-title">Edit Asset</h2>
                <p>Update the asset information.</p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setEditOpen(false)}
                disabled={busy}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveEdit} noValidate>
              {editError && (
                <div className="ops-asset-detail-error" role="alert">
                  {editError}
                </div>
              )}

              <div className="ops-asset-detail-form-grid">
                {[
                  ["name", "Asset Name *", 120],
                  ["code", "Asset Code", 40],
                  ["category", "Category", 60],
                  ["unit", "Unit", 40],
                  ["serialNumber", "Serial Number", 80],
                  ["location", "Location", 120],
                ].map(([key, label, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      maxLength={max}
                      value={editForm[key]}
                      onChange={(event) =>
                        changeEdit(key, event.target.value)
                      }
                    />
                    {fieldErrors[key] && <small>{fieldErrors[key]}</small>}
                  </label>
                ))}

                <label>
                  Type *
                  <select
                    value={editForm.type}
                    onChange={(event) =>
                      changeEdit("type", event.target.value)
                    }
                  >
                    <option value="">Select type</option>
                    {TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {fieldErrors.type && <small>{fieldErrors.type}</small>}
                </label>

                {asset.status !== "Assigned" && (
                  <label>
                    Status
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        changeEdit("status", event.target.value)
                      }
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    {fieldErrors.status && <small>{fieldErrors.status}</small>}
                  </label>
                )}

                <label>
                  Reorder Level
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editForm.reorderLevel}
                    onChange={(event) =>
                      changeEdit("reorderLevel", event.target.value)
                    }
                  />
                  {fieldErrors.reorderLevel && (
                    <small>{fieldErrors.reorderLevel}</small>
                  )}
                </label>

                <label>
                  Cost (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.cost}
                    onChange={(event) =>
                      changeEdit("cost", event.target.value)
                    }
                  />
                  {fieldErrors.cost && <small>{fieldErrors.cost}</small>}
                </label>

                <label>
                  Purchase Date
                  <input
                    type="date"
                    value={editForm.purchaseDate}
                    onChange={(event) =>
                      changeEdit("purchaseDate", event.target.value)
                    }
                  />
                  {fieldErrors.purchaseDate && (
                    <small>{fieldErrors.purchaseDate}</small>
                  )}
                </label>

                <label>
                  Warranty Until
                  <input
                    type="date"
                    value={editForm.warrantyUntil}
                    onChange={(event) =>
                      changeEdit("warrantyUntil", event.target.value)
                    }
                  />
                  {fieldErrors.warrantyUntil && (
                    <small>{fieldErrors.warrantyUntil}</small>
                  )}
                </label>

                <label className="ops-asset-detail-full">
                  Related Product
                  <select
                    value={editForm.productId}
                    onChange={(event) =>
                      changeEdit("productId", event.target.value)
                    }
                  >
                    <option value="">None</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.productId && (
                    <small>{fieldErrors.productId}</small>
                  )}
                </label>

                <label className="ops-asset-detail-full">
                  Notes
                  <textarea
                    rows={4}
                    maxLength={1000}
                    value={editForm.notes}
                    onChange={(event) =>
                      changeEdit("notes", event.target.value)
                    }
                  />
                  {fieldErrors.notes && <small>{fieldErrors.notes}</small>}
                </label>
              </div>

              <div className="ops-asset-detail-modal-actions">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ops-asset-detail-primary"
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="ops-asset-detail-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="ops-asset-detail-modal-overlay">
          <div
            className="ops-asset-detail-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="asset-delete-title"
          >
            <div className="ops-asset-detail-danger-icon">
              <Trash2 size={24} />
            </div>

            <h2 id="asset-delete-title">Delete Asset?</h2>
            <p>
              Are you sure you want to delete <strong>{asset.name}</strong>?
              This action cannot be undone.
            </p>

            <div className="ops-asset-detail-modal-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ops-asset-detail-danger"
                disabled={busy}
                onClick={deleteAsset}
              >
                {busy ? (
                  <Loader2 className="ops-asset-detail-spin" size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}