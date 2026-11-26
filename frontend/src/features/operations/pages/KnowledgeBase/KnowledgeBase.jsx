import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";
import {
  BookOpen,
  Plus,
  Search,
  Eye,
  CalendarDays,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { opsApi } from "../../services/opsApi";
import "./KnowledgeBase.css";

const PAGE_SIZE = 9;

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ArticleBadge({ value }) {
  const styles = {
    Draft: {
      background: "#EAF6F3",
      color: "#123C3A",
    },
    Published: {
      background: "#E7F7EE",
      color: "#15803D",
    },
    Internal: {
      background: "#E6F0FF",
      color: "#1D4ED8",
    },
    Public: {
      background: "#FFF4E5",
      color: "#B45309",
    },
  };

  return (
    <span
      className="ops-kb-badge"
      style={styles[value] || {}}
    >
      {value}
    </span>
  );
}

export default function KnowledgeBase() {
  const [searchParams, setSearchParams] =
    useSearchParams();

  const status = searchParams.get("status") || "";
  const visibility =
    searchParams.get("visibility") || "";
  const category =
    searchParams.get("category") || "";
  const search = searchParams.get("q") || "";

  const page = Math.max(
    1,
    Number(searchParams.get("page")) || 1
  );

  const [searchInput, setSearchInput] =
    useState(search);
    const [lastSearch, setLastSearch] = useState(search);

    if (search !== lastSearch) {
      setLastSearch(search);
      setSearchInput(search);
    }

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const updateFilters = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === "" || value == null) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });

      if (!Object.hasOwn(updates, "page")) {
        next.delete("page");
      }

      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (searchInput === search) return;

    const timeout = setTimeout(() => {
      updateFilters({ q: searchInput.trim() });
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput, search, updateFilters]);

  // Load categories.
  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const response =
          await (typeof opsApi.articleCategories === "function"
            ? opsApi.articleCategories()
            : opsApi.listArticles({ page: 1, limit: 100 }));

        if (active) {
          setCategories(
            Array.isArray(response?.data)
              ? [...new Set(response.data.map((item) => typeof item === "string" ? item : item.category).filter(Boolean))].sort()
              : []
          );
        }
      } catch {
        if (active) setCategories([]);
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Load articles whenever filters change.
  useEffect(() => {
    let active = true;

    async function loadArticles() {
      setLoading(true);
      setError("");

      try {
        const response = await opsApi.listArticles({
          status,
          visibility,
          category,
          q: search,
          page,
          limit: PAGE_SIZE,
        });

        if (!active) return;

        setArticles(
          Array.isArray(response?.data)
            ? response.data
            : []
        );

        setPagination(
          response?.pagination || {
            page,
            limit: PAGE_SIZE,
            total: response?.data?.length || 0,
            pages: 1,
          }
        );
      } catch (err) {
        if (!active) return;

        setArticles([]);
        setError(
          err.message || "Unable to load articles."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadArticles();

    return () => {
      active = false;
    };
  }, [
    status,
    visibility,
    category,
    search,
    page,
    reloadKey,
  ]);

  const totalPages = Math.max(
    1,
    Number(pagination.pages) || 1
  );

  return (
    <div className="ops-kb-page">
      {/* HEADER */}

      <div className="ops-kb-header">
        <div className="ops-kb-heading">
          <div className="ops-kb-heading-icon">
            <BookOpen size={24} />
          </div>

          <div>
            <h1>Knowledge Base</h1>
            <p>
              {loading
                ? "Loading articles..."
                : `${pagination.total} article${
                    pagination.total === 1 ? "" : "s"
                  } found`}
            </p>
          </div>
        </div>

        <Link
          to="/operations/knowledge-base/new"
          className="ops-kb-primary-button"
        >
          <Plus size={18} />
          New Article
        </Link>
      </div>

      {/* SEARCH AND FILTERS */}

      <section className="ops-kb-filter-panel">
        <div className="ops-kb-search">
          <Search size={19} />

          <input
            type="search"
            placeholder="Search knowledge base articles..."
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
            aria-label="Search articles"
          />
        </div>

        <div className="ops-kb-filters">
          <label>
            <span>Status</span>

            <select
              value={status}
              onChange={(event) =>
                updateFilters({
                  status: event.target.value,
                })
              }
            >
              <option value="">All Statuses</option>
              <option value="Published">
                Published
              </option>
              <option value="Draft">Draft</option>
            </select>
          </label>

          <label>
            <span>Visibility</span>

            <select
              value={visibility}
              onChange={(event) =>
                updateFilters({
                  visibility: event.target.value,
                })
              }
            >
              <option value="">All Visibility</option>
              <option value="Internal">
                Internal
              </option>
              <option value="Public">Public</option>
            </select>
          </label>

          <label>
            <span>Category</span>

            <select
              value={category}
              onChange={(event) =>
                updateFilters({
                  category: event.target.value,
                })
              }
            >
              <option value="">
                All Categories
              </option>

              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="ops-kb-refresh-button"
            title="Refresh articles"
            aria-label="Refresh articles"
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </section>

      {/* ARTICLES */}

      {loading ? (
        <div className="ops-kb-state">
          <RefreshCw
            size={28}
            className="ops-kb-loading-icon"
          />
          <p>Loading knowledge base articles...</p>
        </div>
      ) : error ? (
        <div
          className="ops-kb-state ops-kb-error"
          role="alert"
        >
          <AlertCircle size={28} />
          <h3>Unable to load articles</h3>
          <p>{error}</p>

          <button
            type="button"
            className="ops-kb-secondary-button"
            onClick={() =>
              setReloadKey((current) => current + 1)
            }
          >
            Try Again
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div className="ops-kb-state">
          <BookOpen size={32} />
          <h3>No articles match</h3>
          <p>
            Try changing your search or filters, or
            create a new knowledge base article.
          </p>

          <Link
            to="/operations/knowledge-base/new"
            className="ops-kb-primary-button"
          >
            <Plus size={17} />
            New Article
          </Link>
        </div>
      ) : (
        <>
          <div className="ops-kb-grid">
            {articles.map((article) => (
              <Link
                key={article._id}
                to={`/operations/knowledge-base/${article._id}`}
                className="ops-kb-article-card"
              >
                <div className="ops-kb-card-top">
                  <div className="ops-kb-card-icon">
                    <BookOpen size={21} />
                  </div>

                  <div className="ops-kb-card-badges">
                    <ArticleBadge
                      value={article.status}
                    />

                    <ArticleBadge
                      value={article.visibility}
                    />
                  </div>
                </div>

                <h2>{article.title}</h2>

                <p className="ops-kb-card-summary">
                  {article.summary ||
                    "No summary provided."}
                </p>

                <div className="ops-kb-card-category">
                  {article.category || "General"}
                </div>

                {Array.isArray(article.tags) &&
                  article.tags.length > 0 && (
                    <div className="ops-kb-card-tags">
                      {article.tags.map((tag) => (
                        <span key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                <div className="ops-kb-card-footer">
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(article.updatedAt)}
                    {article.authorName
                      ? ` by ${article.authorName}`
                      : ""}
                  </span>

                  <span>
                    <Eye size={15} />
                    {article.views ?? 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* PAGINATION */}

          {totalPages > 1 && (
            <div className="ops-kb-pagination">
              <span>
                Page {page} of {totalPages}
              </span>

              <div className="ops-kb-pagination-buttons">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    updateFilters({
                      page: page - 1,
                    })
                  }
                >
                  <ChevronLeft size={17} />
                  Previous
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    updateFilters({
                      page: page + 1,
                    })
                  }
                >
                  Next
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
