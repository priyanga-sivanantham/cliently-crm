import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Package,
} from "lucide-react";

import { opsApi } from "../../services/opsApi";
import "./Assets.css";

const TYPES = ["Hardware", "Software", "License", "Consumable"];

const STATUSES = [
  "In Stock",
  "Assigned",
  "In Repair",
  "Retired",
];

const INITIAL_FORM = {
  name: "",
  type: "",
  code: "",
  category: "",
  quantity: "1",
  unit: "pcs",
  reorderLevel: "0",
  serialNumber: "",
  location: "",
  cost: "",
  purchaseDate: "",
  warrantyUntil: "",
  productId: "",
  notes: "",
};

function formatQuantity(value) {
  return Number(value ?? 0).toLocaleString("en-IN");
}

function getAssignment(asset) {
  const assignment = asset.assignment;

  if (!assignment) return "—";

  if (assignment.customerName) {
    return assignment.customerName;
  }

  if (assignment.workOrderId?.number != null) {
    return `WO-${String(
      assignment.workOrderId.number
    ).padStart(4, "0")}`;
  }

  return "—";
}

async function fetchAssets(filters) {
  try {
    const response = await opsApi.listAssets({ ...filters, limit: 20 });
    return {
      assets: Array.isArray(response?.data) ? response.data : [],
      pagination: response?.pagination || {
        page: 1,
        limit: 20,
        total: response?.data?.length || 0,
        pages: 1,
      },
      error: "",
    };
  } catch (err) {
    return { assets: [], pagination: null, error: err?.message || "Unable to load assets." };
  }
}

function StatusBadge({ status }) {
  const className = String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return (
    <span
      className={`ops-assets-status ops-assets-status-${className}`}
    >
      {status || "—"}
    </span>
  );
}

export default function Assets() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
  const type = searchParams.get("type") || "";
  const lowStock = searchParams.get("lowStock") === "true";
  const sort = searchParams.get("sort") || "newest";
  const q = searchParams.get("q") || "";
  const page = Math.max(
    1,
    Number(searchParams.get("page")) || 1
  );

  const [searchText, setSearchText] = useState(q);
  const [lastQ, setLastQ] = useState(q);

  if (q !== lastQ) {
    setLastQ(q);
    setSearchText(q);
  }
  const [assets, setAssets] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const filterKey = [status, type, lowStock, q, sort, page].join("|");
  const [loadedKey, setLoadedKey] = useState(filterKey);

  if (filterKey !== loadedKey) {
    setLoadedKey(filterKey);
    setLoading(true);
    setError("");
  }

  const updateParams = useCallback(
    (updates) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          Object.entries(updates).forEach(([key, value]) => {
            if (
              value === "" ||
              value === null ||
              value === undefined ||
              value === false
            ) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });

          if (!Object.prototype.hasOwnProperty.call(
            updates,
            "page"
          )) {
            next.delete("page");
          }

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim() !== q) {
        updateParams({ q: searchText.trim() });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText, q, updateParams]);

  const applyResult = useCallback((result) => {
    setAssets(result.assets);
    if (result.pagination) setPagination(result.pagination);
    setError(result.error);
    setLoading(false);
  }, []);

  const filters = useMemo(
    () => ({ status, type, lowStock: lowStock ? "true" : "", q, sort, page }),
    [status, type, lowStock, q, sort, page]
  );

  const loadAssets = useCallback(async () => {
    applyResult(await fetchAssets(filters));
  }, [filters, applyResult]);

  useEffect(() => {
    let active = true;
    fetchAssets(filters).then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [filters, applyResult]);

  useEffect(() => {
    if (!showCreate) return;

    let active = true;

    async function loadProducts() {
      try {
        const productLoader = opsApi.listProducts || opsApi.products;
        if (typeof productLoader !== "function") {
          setProducts([]);
          return;
        }
        const response = await productLoader.call(opsApi);

        if (active) {
          setProducts(
            Array.isArray(response?.data)
              ? response.data
              : []
          );
        }
      } catch {
        if (active) setProducts([]);
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [showCreate]);

  function openCreate() {
    setForm(INITIAL_FORM);
    setFieldErrors({});
    setFormError("");
    setShowCreate(true);
  }

  function closeCreate() {
    if (saving) return;
    setShowCreate(false);
  }

  function changeField(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Asset name is required.";
    }

    if (!form.type) {
      errors.type = "Please select an asset type.";
    }

    if (
      form.quantity === "" ||
      !Number.isInteger(Number(form.quantity)) ||
      Number(form.quantity) < 0
    ) {
      errors.quantity =
        "Quantity must be a whole number of 0 or more.";
    }

    if (
      form.reorderLevel === "" ||
      !Number.isInteger(Number(form.reorderLevel)) ||
      Number(form.reorderLevel) < 0
    ) {
      errors.reorderLevel =
        "Reorder level must be a whole number of 0 or more.";
    }

    if (
      form.cost !== "" &&
      (!Number.isFinite(Number(form.cost)) ||
        Number(form.cost) < 0)
    ) {
      errors.cost = "Cost cannot be negative.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please correct the highlighted fields.");
      return;
    }

    setSaving(true);
    setFormError("");
    setFieldErrors({});

    const body = {
      name: form.name.trim(),
      type: form.type,
      code: form.code.trim(),
      category: form.category.trim(),
      quantity: Number(form.quantity),
      unit: form.unit.trim() || "pcs",
      reorderLevel: Number(form.reorderLevel),
      serialNumber: form.serialNumber.trim(),
      location: form.location.trim(),
      purchaseDate: form.purchaseDate || null,
      warrantyUntil: form.warrantyUntil || null,
      productId: form.productId || null,
      notes: form.notes.trim(),
    };

    if (form.cost !== "") {
      body.cost = Number(form.cost);
    }

    try {
      const response = await opsApi.createAsset(body);
      const created = response?.data;

      if (!created?._id && response?.success === false) {
        throw new Error("Asset creation was not confirmed.");
      }
      setShowCreate(false);

      if (created?._id) {
        navigate(`/operations/assets/${created._id}`);
      } else {
        await loadAssets();
      }
    } catch (err) {
      setFormError(
        err?.message || "Unable to create asset."
      );
      setFieldErrors(err?.errors || {});
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(
    1,
    Number(pagination.pages) || 1
  );

  return (
    <div className="ops-assets-page">
      <div className="ops-assets-header">
        <div>
          <div className="ops-assets-eyebrow">
            <Boxes size={16} />
            OPERATIONS MANAGEMENT
          </div>

          <h1>Inventory &amp; Assets</h1>

          <p>
            Track company equipment, stock levels,
            and asset assignments.
          </p>
        </div>

        <button
          type="button"
          className="ops-assets-primary-btn"
          onClick={openCreate}
        >
          <Plus size={17} />
          New Asset
        </button>
      </div>

      <div className="ops-assets-summary">
        <div className="ops-assets-summary-icon">
          <Package size={22} />
        </div>

        <div>
          <strong>
            {Number(pagination.total || 0).toLocaleString(
              "en-IN"
            )}
          </strong>
          <span>Total matching assets</span>
        </div>
      </div>

      <div className="ops-assets-panel">
        <div className="ops-assets-panel-heading">
          <div>
            <h2>Asset Directory</h2>
            <p>Search and manage your inventory records.</p>
          </div>

          <div className="ops-assets-panel-icon">
            <Filter size={18} />
          </div>
        </div>

        <div className="ops-assets-filters">
          <div className="ops-assets-search">
            <Search size={18} />
            <input
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="Search name, code, serial, category..."
              aria-label="Search assets"
            />
          </div>

          <select
            value={type}
            onChange={(event) =>
              updateParams({ type: event.target.value })
            }
            aria-label="Filter by asset type"
          >
            <option value="">All Types</option>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) =>
              updateParams({ status: event.target.value })
            }
            aria-label="Filter by asset status"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) =>
              updateParams({ sort: event.target.value })
            }
            aria-label="Sort assets"
          >
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="quantity">Lowest Quantity</option>
          </select>
        </div>

        <label className="ops-assets-low-stock-filter">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(event) =>
              updateParams({
                lowStock: event.target.checked
                  ? "true"
                  : "",
              })
            }
          />

          <AlertTriangle size={15} />
          Low stock only
        </label>

        {error && (
          <div className="ops-assets-error" role="alert">
            {error}
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                loadAssets();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="ops-assets-state">
            <Loader2
              size={28}
              className="ops-assets-spinner"
            />
            <p>Loading inventory...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="ops-assets-state">
            <Package size={38} />
            <h3>No assets found</h3>
            <p>
              {q || status || type || lowStock
                ? "Try changing your search or filters."
                : "Add your first asset to start tracking inventory."}
            </p>

            <button
              type="button"
              className="ops-assets-primary-btn"
              onClick={openCreate}
            >
              <Plus size={16} />
              New Asset
            </button>
          </div>
        ) : (
          <>
            <div className="ops-assets-table-scroll">
              <table className="ops-assets-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Location</th>
                  </tr>
                </thead>

                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset._id}
                      onClick={() =>
                        navigate(
                          `/operations/assets/${asset._id}`
                        )
                      }
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          navigate(
                            `/operations/assets/${asset._id}`
                          );
                        }
                      }}
                      aria-label={`View ${asset.name}`}
                    >
                      <td>
                        <div className="ops-assets-name">
                          {asset.name}
                        </div>
                        <div className="ops-assets-code">
                          {asset.code || "No asset code"}
                        </div>
                      </td>

                      <td>{asset.type || "—"}</td>
                      <td>{asset.category || "—"}</td>

                      <td>
                        <div className="ops-assets-quantity">
                          {formatQuantity(asset.quantity)}{" "}
                          {asset.unit || "pcs"}
                        </div>

                        {asset.lowStock && (
                          <span className="ops-assets-low-badge">
                            <AlertTriangle size={11} />
                            Low stock
                          </span>
                        )}
                      </td>

                      <td>
                        <StatusBadge status={asset.status} />
                      </td>

                      <td>{getAssignment(asset)}</td>
                      <td>{asset.location || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ops-assets-pagination">
              <span>
                Page {page} of {totalPages} ·{" "}
                {pagination.total || 0} assets
              </span>

              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    updateParams({ page: page - 1 })
                  }
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    updateParams({ page: page + 1 })
                  }
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <div
          className="ops-assets-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreate();
            }
          }}
        >
          <div
            className="ops-assets-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-assets-modal-title"
          >
            <div className="ops-assets-modal-header">
              <div>
                <h2 id="ops-assets-modal-title">
                  Create New Asset
                </h2>
                <p>Enter the inventory details below.</p>
              </div>

              <button
                type="button"
                onClick={closeCreate}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} noValidate>
              {formError && (
                <div
                  className="ops-assets-form-error"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <div className="ops-assets-form-grid">
                <label className="ops-assets-field">
                  <span>Asset Name *</span>
                  <input
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(event) =>
                      changeField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Dell Latitude Laptop"
                  />
                  {fieldErrors.name && (
                    <small>{fieldErrors.name}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Asset Type *</span>
                  <select
                    required
                    value={form.type}
                    onChange={(event) =>
                      changeField(
                        "type",
                        event.target.value
                      )
                    }
                  >
                    <option value="">Select type</option>
                    {TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.type && (
                    <small>{fieldErrors.type}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Asset Code</span>
                  <input
                    maxLength={40}
                    value={form.code}
                    onChange={(event) =>
                      changeField(
                        "code",
                        event.target.value
                      )
                    }
                    placeholder="e.g. AST-001"
                  />
                  {fieldErrors.code && (
                    <small>{fieldErrors.code}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Category</span>
                  <input
                    maxLength={60}
                    value={form.category}
                    onChange={(event) =>
                      changeField(
                        "category",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Laptops"
                  />
                  {fieldErrors.category && (
                    <small>{fieldErrors.category}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Initial Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.quantity}
                    onChange={(event) =>
                      changeField(
                        "quantity",
                        event.target.value
                      )
                    }
                  />
                  {fieldErrors.quantity && (
                    <small>{fieldErrors.quantity}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Unit</span>
                  <input
                    maxLength={40}
                    value={form.unit}
                    onChange={(event) =>
                      changeField(
                        "unit",
                        event.target.value
                      )
                    }
                    placeholder="pcs"
                  />
                  {fieldErrors.unit && (
                    <small>{fieldErrors.unit}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Reorder Level</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.reorderLevel}
                    onChange={(event) =>
                      changeField(
                        "reorderLevel",
                        event.target.value
                      )
                    }
                  />
                  {fieldErrors.reorderLevel && (
                    <small>{fieldErrors.reorderLevel}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Serial Number</span>
                  <input
                    maxLength={80}
                    value={form.serialNumber}
                    onChange={(event) =>
                      changeField(
                        "serialNumber",
                        event.target.value
                      )
                    }
                  />
                  {fieldErrors.serialNumber && (
                    <small>{fieldErrors.serialNumber}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Location</span>
                  <input
                    maxLength={120}
                    value={form.location}
                    onChange={(event) =>
                      changeField(
                        "location",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Storage Room A"
                  />
                  {fieldErrors.location && (
                    <small>{fieldErrors.location}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Cost (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost}
                    onChange={(event) =>
                      changeField(
                        "cost",
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                  />
                  {fieldErrors.cost && (
                    <small>{fieldErrors.cost}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Purchase Date</span>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(event) =>
                      changeField(
                        "purchaseDate",
                        event.target.value
                      )
                    }
                  />
                  {fieldErrors.purchaseDate && (
                    <small>{fieldErrors.purchaseDate}</small>
                  )}
                </label>

                <label className="ops-assets-field">
                  <span>Warranty Until</span>
                  <input
                    type="date"
                    value={form.warrantyUntil}
                    onChange={(event) =>
                      changeField(
                        "warrantyUntil",
                        event.target.value
                      )
                    }
                  />
                  {fieldErrors.warrantyUntil && (
                    <small>{fieldErrors.warrantyUntil}</small>
                  )}
                </label>

                <label className="ops-assets-field ops-assets-field-full">
                  <span>Related Product</span>
                  <select
                    value={form.productId}
                    onChange={(event) =>
                      changeField(
                        "productId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">None</option>
                    {products.map((product) => (
                      <option
                        key={product._id}
                        value={product._id}
                      >
                        {product.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.productId && (
                    <small>{fieldErrors.productId}</small>
                  )}
                </label>

                <label className="ops-assets-field ops-assets-field-full">
                  <span>Notes</span>
                  <textarea
                    rows={4}
                    maxLength={1000}
                    value={form.notes}
                    onChange={(event) =>
                      changeField(
                        "notes",
                        event.target.value
                      )
                    }
                    placeholder="Additional asset information..."
                  />
                  <span className="ops-assets-char-count">
                    {form.notes.length}/1000
                  </span>
                  {fieldErrors.notes && (
                    <small>{fieldErrors.notes}</small>
                  )}
                </label>
              </div>

              <div className="ops-assets-modal-actions">
                <button
                  type="button"
                  className="ops-assets-cancel-btn"
                  onClick={closeCreate}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ops-assets-primary-btn"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="ops-assets-spinner"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Asset
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}