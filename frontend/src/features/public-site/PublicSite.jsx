import { useEffect, useMemo, useRef, useState } from "react";
import { Link,useParams } from "react-router-dom";
import { getPublicSite, sendEnquiry } from "./publicSiteApi";
import "./PublicSite.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  productId: "",
  message: "",
  consent: false,
  companyWebsite: "",
};
const BILLING_TEXT = {
  Monthly: "/ month",
  Yearly: "/ year",
  "One-time": "one-time",
};

const PRICE_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatPrice(product) {
  if (product.price == null) return "Price on request";
  const amount = PRICE_FORMAT.format(product.price);
  const billing = BILLING_TEXT[product.billing];
  return billing ? `${amount} ${billing}` : amount;
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function safeUrl(value) {
  if (!value) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(value)
    ? value
    : `https://${value}`;
  return /^https?:\/\//i.test(url) ? url : null;
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required";
  if (!form.email.trim()) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "Enter a valid email address";
  }
  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = "Enter a valid phone number";
  }
  if (form.message.length > 1000) {
    errors.message = "Message must be 1000 characters or less";
  }
  if (!form.consent) errors.consent = "Please agree to be contacted";
  return errors;
}

function ProductCard({ product, onEnquire, index }) {
  return (
    <article
      className="ps-product ps-glass-card"
      style={{ "--ps-card-index": index }}
    >
      <div className="ps-product-media">
        {product.imageUrl ? (
          <img
            className="ps-product-image"
            src={product.imageUrl}
            alt={product.name || ""}
            loading="lazy"
          />
        ) : (
          <div
            className="ps-product-image ps-product-placeholder"
            aria-hidden="true"
          >
            {initials(product.name)}
          </div>
        )}
        <span className="ps-product-media-glow" aria-hidden="true" />
      </div>

      <div className="ps-product-body">
        <div className="ps-product-tags">
          {product.type && <span className="ps-tag">{product.type}</span>}
          {product.category && (
            <span className="ps-tag ps-tag-muted">{product.category}</span>
          )}
        </div>

        <h3>{product.name}</h3>
        {product.description && (
          <p className="ps-product-description">{product.description}</p>
        )}

        <div className="ps-product-footer">
          <div className="ps-price-block">
            <strong className="ps-price">{formatPrice(product)}</strong>
            {product.duration && (
              <small className="ps-duration">{product.duration}</small>
            )}
          </div>
          <button
            type="button"
            className="ps-button ps-button-small"
            onClick={() => onEnquire(product._id)}
          >
            Enquire <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function Field({ label, error, wide, children }) {
  return (
    <label className={`ps-field${wide ? " ps-field-wide" : ""}`}>
      <span className="ps-label">{label}</span>
      {children}
      {error && <small className="ps-error">{error}</small>}
    </label>
  );
}

function EnquiryForm({ slug, products, form, setForm }) {
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [lastProductId, setLastProductId] = useState(form.productId);

  if (form.productId !== lastProductId) {
    setLastProductId(form.productId);
    if (form.productId && status === "sent") setStatus("idle");
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "sending") return;

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus("sending");
    setServerMessage("");

    try {
      const response = await sendEnquiry(slug, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        productId: form.productId,
        message: form.message.trim(),
        consent: form.consent,
        companyWebsite: form.companyWebsite,
      });

      setServerMessage(
        response?.message || "Thank you! Our team will contact you soon."
      );
      setForm(EMPTY_FORM);
      setErrors({});
      setStatus("sent");
    } catch (err) {
      setErrors(err?.errors || {});
      setServerMessage(
        err?.status === 429
          ? "Too many enquiries. Please try again in a few minutes."
          : err?.message || "Could not send your enquiry. Please try again."
      );
      setStatus("failed");
    }
  }

  if (status === "sent") {
    return (
      <div className="ps-form ps-form-success ps-glass-card" role="status">
        <div className="ps-success-icon" aria-hidden="true">
          ✓
        </div>
        <span className="ps-form-kicker">Message received</span>
        <h3>Enquiry sent</h3>
        <p>{serverMessage}</p>
        <button
          type="button"
          className="ps-button ps-button-ghost"
          onClick={() => setStatus("idle")}
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  const invalid = (field) => Boolean(errors[field]);

  return (
    <form className="ps-form ps-glass-card" onSubmit={handleSubmit} noValidate>
      <div className="ps-form-heading">
        <span className="ps-form-kicker">LET'S TALK</span>
        <h3>Tell us what you need</h3>
        <p>Share a few details and our team will get back to you.</p>
      </div>

      <div className="ps-form-grid">
        <Field label="Name *" error={errors.name}>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            maxLength={100}
            autoComplete="name"
            aria-invalid={invalid("name")}
            required
          />
        </Field>

        <Field label="Email *" error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            maxLength={120}
            autoComplete="email"
            aria-invalid={invalid("email")}
            required
          />
        </Field>

        <Field label="Phone" error={errors.phone}>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            maxLength={20}
            autoComplete="tel"
            aria-invalid={invalid("phone")}
          />
        </Field>

        <Field label="Company" error={errors.company}>
          <input
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
            maxLength={100}
            autoComplete="organization"
            aria-invalid={invalid("company")}
          />
        </Field>

        <Field label="Interested in" error={errors.productId} wide>
          <select
            value={form.productId}
            onChange={(e) => update("productId", e.target.value)}
            aria-invalid={invalid("productId")}
          >
            <option value="">General enquiry</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Message" error={errors.message} wide>
          <textarea
            rows={4}
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            maxLength={1000}
            placeholder="Tell us what you need..."
            aria-invalid={invalid("message")}
          />
          <small className="ps-counter">{form.message.length}/1000</small>
        </Field>

        <label className="ps-honeypot" aria-hidden="true">
          <span>Company website</span>
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.companyWebsite}
            onChange={(e) => update("companyWebsite", e.target.value)}
          />
        </label>

        <div className="ps-field-wide">
          <label className="ps-consent">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => update("consent", e.target.checked)}
              aria-invalid={invalid("consent")}
            />
            <span>I agree to be contacted about my enquiry.</span>
          </label>
          {errors.consent && (
            <small className="ps-error">{errors.consent}</small>
          )}
        </div>
      </div>

      {status === "failed" && serverMessage && (
        <div className="ps-alert" role="alert">
          {serverMessage}
        </div>
      )}

      <button
        type="submit"
        className="ps-button ps-button-full"
        disabled={status === "sending"}
      >
        {status === "sending" ? (
          <>
            <span className="ps-button-spinner" aria-hidden="true" />
            Sending...
          </>
        ) : (
          <>
            Send enquiry <span aria-hidden="true">↗</span>
          </>
        )}
      </button>
      <p className="ps-form-note">Your details are only used to respond to your enquiry.</p>
    </form>
  );
}

export default function PublicSite() {
  const { slug } = useParams();
  const [result, setResult] = useState({
    slug: null,
    status: "loading",
    site: null,
  });
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [shownSlug, setShownSlug] = useState(slug);
  const contactRef = useRef(null);

  if (slug !== shownSlug) {
    setShownSlug(slug);
    setCategory("All");
    setSearch("");
    setForm(EMPTY_FORM);
  }

  useEffect(() => {
    let active = true;

    getPublicSite(slug)
      .then((response) => {
        if (active) {
          setResult({
            slug,
            status: "ready",
            site: response?.data || null,
          });
        }
      })
      .catch((err) => {
        if (active) {
          setResult({
            slug,
            status: err?.status === 404 ? "missing" : "error",
            site: null,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const state = result.slug === slug ? result.status : "loading";
  const site = result.slug === slug ? result.site : null;

  useEffect(() => {
    const name = site?.company?.companyName;
    if (!name) return undefined;

    const previous = document.title;
    document.title = name;

    return () => {
      document.title = previous;
    };
  }, [site]);

  const products = useMemo(() => site?.products || [], [site]);

  const categories = useMemo(
    () => ["All", ...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  );

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!term ||
          [p.name, p.description, p.category]
            .join(" ")
            .toLowerCase()
            .includes(term))
    );
  }, [products, category, search]);

  function scrollToContact() {
    contactRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function enquireAbout(productId) {
    setForm((current) => ({ ...current, productId }));
    scrollToContact();
  }

  if (state === "loading") {
    return (
      <div className="public-site ps-center">
        <div className="ps-loading-content">
          <div className="ps-spinner" role="status" aria-label="Loading" />
          <p>Preparing your experience...</p>
        </div>
      </div>
    );
  }

  if (state === "missing" || state === "error" || !site?.company) {
    const missing = state === "missing";

    return (
      <div className="public-site ps-center">
        <div className="ps-empty-page ps-glass-card">
          <span className="ps-form-kicker">PUBLIC WEBSITE</span>
          <h1>{missing ? "Page not found" : "Something went wrong"}</h1>
          <p>
            {missing
              ? "This company page doesn't exist or is not available right now."
              : "We couldn't load this page. Please try again."}
          </p>
          {!missing && (
            <button
              type="button"
              className="ps-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const { company } = site;
  const websiteUrl = safeUrl(company.website);
  const phoneHref = company.phone
    ? company.phone.replace(/[^\d+]/g, "")
    : "";
  const hasContactInfo =
    company.email || company.phone || company.address || websiteUrl;

  return (
    <div className="public-site">
      <header className="ps-header">
        <div className="ps-container ps-header-inner">
          <a href="#top" className="ps-brand">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt=""
                className="ps-logo"
              />
            ) : (
              <span className="ps-logo ps-logo-text">
                {initials(company.companyName)}
              </span>
            )}
            <span className="ps-brand-name">{company.companyName}</span>
          </a>

          <nav className="ps-nav" aria-label="Page sections">
            <a href="#products">Products</a>
            <a href="#contact">Contact</a>
          </nav>

          <Link
            to={`/site/${slug}/login`}
            className="ps-button ps-button-small ps-button-ghost"
          >
            Customer login
          </Link>

          <button
            type="button"
            className="ps-button ps-button-small"
            onClick={scrollToContact}
          >
            Let's talk <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <main id="top" className="ps-main">
        <section className="ps-hero">
          <div className="ps-hero-layout">
            <div className="ps-hero-light">
              <div className="ps-hero-copy">
                <span className="ps-eyebrow">
                  <span className="ps-eyebrow-dot" />
                  {company.industry || "WELCOME"}
                </span>
                <h1>{company.tagline || `Welcome to ${company.companyName}`}</h1>
                <p className="ps-hero-description">
                  Explore our products and services, and connect with our team to find the right solution for your needs.
                </p>
                <div className="ps-hero-actions">
                  <a href="#products" className="ps-button">
                    Explore products <span aria-hidden="true">↘</span>
                  </a>
                  <button type="button" className="ps-button ps-button-ghost" onClick={scrollToContact}>
                    Send an enquiry
                  </button>
                </div>
              </div>
            </div>

            <div className="ps-hero-dark">
              <span className="ps-dark-orbit ps-dark-orbit-one" aria-hidden="true" />
              <span className="ps-dark-orbit ps-dark-orbit-two" aria-hidden="true" />
              <div className="ps-dark-content">
                <span className="ps-dark-kicker">A BETTER WAY FORWARD</span>
                <h2>Good work starts with <span>good connections.</span></h2>
                <div className="ps-feature-list">
                  <div className="ps-feature-row">
                    <span className="ps-feature-number">01</span>
                    <div>
                      <h3>Explore with clarity</h3>
                      <p>Browse products and services in one simple place.</p>
                    </div>
                  </div>
                  <div className="ps-feature-row">
                    <span className="ps-feature-number">02</span>
                    <div>
                      <h3>Find the right fit</h3>
                      <p>Search offerings and choose what suits your needs.</p>
                    </div>
                  </div>
                  <div className="ps-feature-row">
                    <span className="ps-feature-number">03</span>
                    <div>
                      <h3>Talk to our team</h3>
                      <p>Send an enquiry and let us help with the next step.</p>
                    </div>
                  </div>
                </div>
                <div className="ps-dark-bottom">
                  <strong>One place. Clear possibilities.</strong>
                  <span>Discover what works for you.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="products" className="ps-section ps-products-section">
          <div className="ps-container">
            <div className="ps-section-heading">
              <div className="ps-heading-copy">
                <span className="ps-section-kicker">WHAT WE OFFER</span>
                <h2>Find your next <span>great fit.</span></h2>
                <p>
                  Explore our products and services, thoughtfully designed to
                  help you move forward.
                </p>
              </div>
              <div className="ps-offering-count">
                <strong>{products.length.toString().padStart(2, "0")}</strong>
                <span>{products.length === 1 ? "offering" : "offerings"}<br />available</span>
              </div>
            </div>

            <div className="ps-product-tools">
              {products.length > 0 && (
                <label className="ps-search-wrap">
                  <span aria-hidden="true" className="ps-search-icon">⌕</span>
                  <input
                    className="ps-search"
                    type="search"
                    placeholder="Search offerings..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search products"
                  />
                  {search && (
                    <button
                      className="ps-clear-search"
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </label>
              )}

              {categories.length > 2 && (
                <div className="ps-chips" role="group" aria-label="Filter by category">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={category === item}
                      className={`ps-chip${category === item ? " is-active" : ""}`}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {visibleProducts.length > 0 ? (
              <div
                className="ps-product-grid"
                data-count={Math.min(visibleProducts.length, 3)}
              >
                {visibleProducts.map((product, index) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    index={index}
                    onEnquire={enquireAbout}
                  />
                ))}
              </div>
            ) : (
              <div className="ps-empty ps-glass-card">
                <span className="ps-empty-icon" aria-hidden="true">⌕</span>
                <h3>{products.length ? "No matches found" : "Good things are coming"}</h3>
                <p>
                  {products.length
                    ? "Try another search term or choose a different category."
                    : "Our offerings will be listed here soon. You can still send us an enquiry."}
                </p>
                {products.length > 0 && (search || category !== "All") && (
                  <button
                    type="button"
                    className="ps-button ps-button-ghost"
                    onClick={() => {
                      setSearch("");
                      setCategory("All");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </section>


        <section id="contact" ref={contactRef} className="ps-section ps-contact-section">
          <div className="ps-container">
            <div className="ps-contact-intro">
              <span className="ps-section-kicker">YOUR NEXT STEP</span>
              <h2>Let's make something <span>happen.</span></h2>
              <p>Have a question or a project in mind? We'd love to hear from you.</p>
            </div>

            <div className="ps-contact">
              <div className="ps-contact-info ps-glass-card">
                <span className="ps-contact-icon" aria-hidden="true">✳</span>
                <h3>Let's start a conversation.</h3>
                <p>
                  Tell us a little about what you need. We'll help you figure
                  out the next step.
                </p>

                {hasContactInfo && (
                  <ul>
                    {company.email && (
                      <li>
                        <span className="ps-contact-label">EMAIL US</span>
                        <a href={`mailto:${company.email}`}>{company.email}</a>
                      </li>
                    )}
                    {company.phone && (
                      <li>
                        <span className="ps-contact-label">CALL US</span>
                        <a href={`tel:${phoneHref}`}>{company.phone}</a>
                      </li>
                    )}
                    {company.address && (
                      <li>
                        <span className="ps-contact-label">FIND US</span>
                        <address>{company.address}</address>
                      </li>
                    )}
                    {websiteUrl && (
                      <li>
                        <span className="ps-contact-label">WEBSITE</span>
                        <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                          {websiteUrl.replace(/^https?:\/\//i, "")}
                        </a>
                      </li>
                    )}
                  </ul>
                )}
                <div className="ps-contact-decoration" aria-hidden="true">✳</div>
              </div>

              <EnquiryForm
                slug={slug}
                products={products}
                form={form}
                setForm={setForm}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="ps-footer">
        <div className="ps-container ps-footer-inner">
          <a href="#top" className="ps-footer-brand">
            <span className="ps-footer-mark">{initials(company.companyName)}</span>
            <span>{company.companyName}</span>
          </a>
          <span>© {new Date().getFullYear()} {company.companyName}. All rights reserved.</span>
          <a className="ps-powered" href="#top">Powered by <strong>Cliently</strong> ↑</a>
        </div>
      </footer>
    </div>
  );
}
