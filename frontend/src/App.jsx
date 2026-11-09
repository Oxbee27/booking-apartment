import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Menu,
  X,
  LogOut,
  Plus,
  Trash2,
  ShieldCheck,
  Printer,
} from "lucide-react";
const API = import.meta.env.DEV
  ? ""
  : (
      import.meta.env.VITE_API_URL || "https://booking-apartment.onrender.com"
    ).replace(/\/$/, "");
const money = (n) => "₦" + Number(n).toLocaleString("en-NG");
const FALLBACK_APARTMENT_IMAGE = "/images/staynest-apartment-fallback.jpg";
const LOCAL_APARTMENT_IMAGES = {
  "photo-1600210492486-724fe5c67fb0": "/images/apartments/azure-loft.jpg",
  "photo-1600607687939-ce8a6c25118c": "/images/apartments/palm-court.jpg",
  "photo-1600566753086-00f18fb6b3ea": "/images/apartments/garden-suite.jpg",
  "photo-1600607687920-4e2a09cf159d":
    "/images/apartments/skyline-penthouse.jpg",
  "photo-1600607687644-c7171b42498f": "/images/apartments/coastal-hideaway.jpg",
  "photo-1600210491892-03d54c0aaf87": "/images/apartments/maple-bedroom.jpg",
};
function ApartmentImage({ src, alt = "", ...props }) {
  const photoId = src?.match(/photo-[^/?]+/)?.[0];
  const preferredSrc = LOCAL_APARTMENT_IMAGES[photoId] || src;
  const [failedSrc, setFailedSrc] = useState("");
  const imageSrc =
    preferredSrc && failedSrc !== preferredSrc
      ? preferredSrc
      : FALLBACK_APARTMENT_IMAGE;
  return (
    <img
      {...props}
      src={imageSrc}
      alt={alt}
      onError={
        imageSrc === FALLBACK_APARTMENT_IMAGE
          ? undefined
          : () => setFailedSrc(preferredSrc)
      }
    />
  );
}
async function request(path, opts = {}) {
  const token = localStorage.getItem("staynest_token");
  const r = await fetch(API + "/api" + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...opts.headers,
    },
  });
  const data = await r
    .json()
    .catch(() => ({ message: "Unexpected server response" }));
  if (!r.ok) throw new Error(data.message || "Request failed");
  return data;
}
function Nav({ user, setUser }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span>staynest</span>
        </Link>
        <button className="mobile-menu" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "nav-links show" : "nav-links"}>
          <Link to="/#stays" onClick={() => setOpen(false)}>
            Explore stays
          </Link>
          <Link
            className="nav-book-link"
            to="/book"
            onClick={() => setOpen(false)}
          >
            Book an apartment
          </Link>
          {user ? (
            <>
              <Link to="/dashboard">My bookings</Link>
              {user.role === "admin" && <Link to="/admin">Admin</Link>}
              <button
                className="nav-logout"
                onClick={() => {
                  localStorage.removeItem("staynest_token");
                  setUser(null);
                }}
              >
                {" "}
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link className="nav-cta" to="/register">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
function Footer() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  async function subscribe(e) {
    e.preventDefault();
    setBusy(true);
    setNotice({ type: "", text: "" });
    try {
      const result = await request("/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email, consent: true }),
      });
      setNotice({ type: "success", text: result.message });
      setEmail("");
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <span>staynest</span>
          </Link>
          <p>Find a place that feels like yours.</p>
        </div>
        <div className="footer-links">
          <Link to="/#stays">Explore stays</Link>
          <a href="/#contact">Make an enquiry</a>
          <Link to="/privacy">Privacy policy</Link>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event("staynest:cookie-settings"))
            }
          >
            Cookie settings
          </button>
        </div>
        <form className="newsletter-form" onSubmit={subscribe}>
          <label htmlFor="newsletter-email">Stay in the know</label>
          <div className="newsletter-controls">
            <input
              id="newsletter-email"
              type="email"
              autoComplete="email"
              placeholder="Email address"
              required
              maxLength="160"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              aria-label="Subscribe to StayNest updates"
            >
              {busy ? "..." : "Subscribe"}
            </button>
          </div>
          <small>
            By subscribing, you agree to receive StayNest updates by email.
          </small>
          {notice.text && (
            <div className={`newsletter-notice ${notice.type}`} role="status">
              {notice.text}
            </div>
          )}
        </form>
        <small>© 2026 StayNest. Made for better stays.</small>
      </div>
    </footer>
  );
}

function CookieConsent() {
  const [choice, setChoice] = useState(() => {
    const match = document.cookie.match(
      /(?:^|; )staynest_cookie_consent=(necessary|all)(?:;|$)/,
    );
    return match?.[1] || "";
  });

  useEffect(() => {
    const reopen = () => setChoice("");
    window.addEventListener("staynest:cookie-settings", reopen);
    return () => window.removeEventListener("staynest:cookie-settings", reopen);
  }, []);

  function choose(value) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `staynest_cookie_consent=${value}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
    setChoice(value);
  }

  if (choice) return null;

  return (
    <aside className="cookie-consent" aria-label="Cookie preferences">
      <div>
        <strong>Cookie preferences</strong>
        <p>
          StayNest uses essential browser storage for sign-in and to remember
          this choice. No advertising or analytics cookies are active. There are
          no optional cookies to enable right now.
          <Link to="/privacy"> Read our privacy policy</Link>.
        </p>
      </div>
      <div className="cookie-actions">
        <button
          type="button"
          className="cookie-secondary"
          onClick={() => choose("necessary")}
        >
          Necessary only
        </button>
        <button
          type="button"
          className="cookie-primary"
          onClick={() => choose("all")}
        >
          Accept all
        </button>
      </div>
    </aside>
  );
}
function ContactSection() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice({ type: "", text: "" });
    try {
      const result = await request("/inquiries", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setNotice({ type: "success", text: result.message });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="contact-section" id="contact">
      <div className="contact-inner">
        <div className="contact-copy">
          <div className="eyebrow">
            <span></span> WE'RE HERE TO HELP
          </div>
          <h2>Have a question about your stay?</h2>
          <p>
            Send our team a message about a listing, a booking, or anything else
            you need to know.
          </p>
        </div>
        <form className="contact-form" onSubmit={submit}>
          <div className="contact-fields">
            <label>
              Your name
              <input
                required
                minLength="2"
                maxLength="80"
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                required
                maxLength="160"
                value={form.email}
                onChange={(e) => change("email", e.target.value)}
              />
            </label>
          </div>
          <label>
            Subject
            <input
              required
              minLength="3"
              maxLength="120"
              value={form.subject}
              onChange={(e) => change("subject", e.target.value)}
            />
          </label>
          <label>
            How can we help?
            <textarea
              required
              minLength="10"
              maxLength="2000"
              rows="5"
              value={form.message}
              onChange={(e) => change("message", e.target.value)}
            />
          </label>
          {notice.text && (
            <div className={`notice ${notice.type}`}>{notice.text}</div>
          )}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Sending…" : "Send enquiry"}
          </button>
        </form>
      </div>
    </section>
  );
}
function HomePage() {
  const [items, setItems] = useState([]),
    [q, setQ] = useState(""),
    [city, setCity] = useState(""),
    [max, setMax] = useState(""),
    [busy, setBusy] = useState(true),
    [err, setErr] = useState("");
  async function load() {
    setBusy(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (city) p.set("city", city);
      if (max) p.set("max", max);
      const d = await request("/apartments?" + p);
      setItems(d.apartments);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <div className="eyebrow light">
            <span></span> STAYS THAT FEEL LIKE HOME
          </div>
          <h1>
            Find your place
            <br />
            in the <em>world.</em>
          </h1>
          <p>
            Thoughtfully selected apartments for the way you want to live, work
            and explore.
          </p>
          <Link to="/book" className="hero-link">
            Book an apartment
          </Link>
        </div>
        <div className="hero-note">
          <span>01 / 06</span>
          <span>Curated spaces. Memorable moments.</span>
        </div>
      </section>
      <section className="search-wrap">
        <form
          className="search-panel"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label>
            <span>DESTINATION</span>
            <div>
              <input
                placeholder="Where do you want to stay?"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </label>
          <label>
            <span>KEYWORDS</span>
            <div>
              <input
                placeholder="Apartment, area or feature"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </label>
          <label>
            <span>MAX NIGHTLY PRICE</span>
            <div>
              <span className="naira">₦</span>
              <input
                type="number"
                min="0"
                placeholder="Any budget"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          </label>
          <button className="search-btn">
            <Search size={17} /> Find a stay
          </button>
        </form>
      </section>
      <section className="section listings" id="stays">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              <span></span> THE STAY COLLECTION
            </div>
            <h2>
              Spaces worth <em>staying for.</em>
            </h2>
            <p>Handpicked apartments in places you'll love.</p>
          </div>
          <span className="result-count">{items.length} properties</span>
        </div>
        {err && <div className="notice error">{err}</div>}
        {busy ? (
          <div className="loading">Finding your next stay…</div>
        ) : (
          <div className="property-grid">
            {items.map((a, i) => (
              <article className="property-card" key={a.id}>
                <Link to={"/apartments/" + a.id} className="property-image">
                  <ApartmentImage src={a.image} alt={a.title} />
                  {a.featured && (
                    <span className="featured">GUEST FAVOURITE</span>
                  )}
                </Link>
                <div className="property-info">
                  <div className="property-location">
                    <input
                      placeholder="Where do you want to stay?"
                      value={a.city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <Link to={"/apartments/" + a.id}>
                    <h3>{a.title}</h3>
                  </Link>
                  <div className="property-meta">
                    <span>{a.bedrooms} bedrooms</span>
                    <i /> <span>{a.bathrooms} baths</span>
                    <i /> <span>Up to {a.guests} guests</span>
                  </div>
                  <div className="property-bottom">
                    <strong>
                      {money(a.price)} <small>/ night</small>
                    </strong>
                    <Link to={"/apartments/" + a.id}>View details</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!busy && items.length === 0 && (
          <div className="empty">
            No apartments match those filters. Try a different search.
          </div>
        )}
      </section>
      <section className="promise">
        <div className="promise-text">
          <div className="eyebrow light">
            <span></span> THE STAYNEST DIFFERENCE
          </div>
          <h2>
            A better stay
            <br />
            starts <em>here.</em>
          </h2>
          <p>
            From the first search to the moment you arrive, we make finding your
            next space feel effortless.
          </p>
        </div>
        <div className="promise-points">
          <div>
            <span>01</span>
            <section>
              <h3>Spaces with character</h3>
              <p>
                Carefully selected apartments with comfort and quality at their
                heart.
              </p>
            </section>
          </div>
          <div>
            <span>02</span>
            <section>
              <h3>Clear, simple booking</h3>
              <p>
                Transparent nightly pricing and a straightforward reservation
                process.
              </p>
            </section>
          </div>
          <div>
            <span>03</span>
            <section>
              <h3>Made for your journey</h3>
              <p>
                Whether it's work, a weekend away or a new chapter, settle in
                your way.
              </p>
            </section>
          </div>
        </div>
      </section>
      <section className="cta-band">
        <div>
          <div className="eyebrow">
            <span></span> YOUR NEXT CHAPTER
          </div>
          <h2>
            Somewhere new
            <br />
            is waiting.
          </h2>
        </div>
        <Link to="/book" className="dark-btn">
          Browse apartments
        </Link>
      </section>
      <ContactSection />
    </>
  );
}
function BookingBrowse() {
  const [apartments, setApartments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/apartments")
      .then((data) => {
        setApartments(data.apartments);
        setSelectedId(data.apartments[0]?.id ?? null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setBusy(false));
  }, []);

  const filteredApartments = apartments.filter((apartment) =>
    `${apartment.title} ${apartment.city} ${apartment.address}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const selectedApartment = apartments.find(
    (apartment) => apartment.id === selectedId,
  );

  return (
    <main className="booking-browse section">
      <header className="booking-browse-heading">
        <div>
          <div className="eyebrow">
            <span></span> STAYNEST BOOKING
          </div>
          <h1>Choose your apartment.</h1>
          <p>
            Browse the stay list, review your choice, then continue to dates and
            payment.
          </p>
        </div>
        <label className="booking-search">
          <span>FIND A STAY</span>
          <input
            type="search"
            placeholder="Search by name or location"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      {error && <div className="notice error">{error}</div>}
      {busy ? (
        <div className="loading">Loading available apartments…</div>
      ) : filteredApartments.length === 0 ? (
        <div className="empty">No apartments match that search.</div>
      ) : (
        <div className="booking-browser">
          <section className="booking-index-list" aria-label="Apartments">
            <div className="booking-index-header">
              <span>{filteredApartments.length} APARTMENTS</span>
              <span>SELECT TO REVIEW</span>
            </div>
            {filteredApartments.map((apartment, index) => (
              <button
                type="button"
                className={`booking-index-item${selectedId === apartment.id ? " selected" : ""}`}
                key={apartment.id}
                onClick={() => setSelectedId(apartment.id)}
                aria-pressed={selectedId === apartment.id}
              >
                <span className="booking-index-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <ApartmentImage src={apartment.image} alt="" />
                <span className="booking-index-copy">
                  <strong>{apartment.title}</strong>
                  <small>{apartment.city}</small>
                </span>
                <span className="booking-index-price">
                  {money(apartment.price)} <small>/ night</small>
                </span>
              </button>
            ))}
          </section>
          <aside className="booking-review" aria-live="polite">
            {selectedApartment ? (
              <>
                <ApartmentImage
                  className="booking-review-image"
                  src={selectedApartment.image}
                  alt={selectedApartment.title}
                />
                <div className="booking-review-content">
                  <div className="eyebrow">
                    <span></span> YOUR SELECTION
                  </div>
                  <h2>{selectedApartment.title}</h2>
                  <p>
                    {selectedApartment.address}, {selectedApartment.city}
                  </p>
                  <div className="booking-review-facts">
                    <span>{selectedApartment.bedrooms} bedrooms</span>
                    <span>{selectedApartment.bathrooms} bathrooms</span>
                    <span>Up to {selectedApartment.guests} guests</span>
                  </div>
                  <div className="booking-review-price">
                    <strong>{money(selectedApartment.price)}</strong>
                    <span>per night</span>
                  </div>
                  <Link
                    to={`/apartments/${selectedApartment.id}`}
                    className="primary-btn booking-continue"
                  >
                    Choose dates & continue
                  </Link>
                  <small>
                    Dates and total are confirmed on the next step. No account
                    is required.
                  </small>
                </div>
              </>
            ) : (
              <div className="booking-review-empty">
                Select an apartment to review it.
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
function Auth({ mode, setUser }) {
  const nav = useNavigate(),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  async function googleSignIn() {
    if (!supabase) {
      setErr(
        "Google sign-in is unavailable. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for this deployment.",
      );
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch {
      setErr("Google sign-in could not be started. Please try again.");
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const d = await request("/auth/" + mode, {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      localStorage.setItem("staynest_token", d.token);
      setUser(d.user);
      nav(d.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-image">
        <div>
          <span>STAY A LITTLE LONGER.</span>
          <h2>
            Make room
            <br />
            for <em>somewhere</em>
            <br />
            wonderful.
          </h2>
        </div>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <Link to="/" className="brand">
          <span>staynest</span>
        </Link>
        <div className="eyebrow">
          <span></span> {mode === "login" ? "WELCOME BACK" : "JOIN STAYNEST"}
        </div>
        <h1>
          {mode === "login" ? "Good to see you." : "Find your next stay."}
        </h1>
        <p>
          {mode === "login"
            ? "Sign in to manage your bookings."
            : "Create an account and make yourself at home."}
        </p>
        {mode === "register" && (
          <label>
            Full name
            <input
              required
              minLength="2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength="8"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        {err && <div className="notice error">{err}</div>}
        <button
          type="button"
          className="google-btn"
          onClick={googleSignIn}
          disabled={busy}
        >
          <span className="google-mark">G</span>
          Continue with Google
        </button>
        <div className="auth-divider">
          <span>OR</span>
        </div>
        <button className="primary-btn" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
        <div className="auth-switch">
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <Link to={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Create one" : "Sign in"}
          </Link>
        </div>
        <small className="secure-note">
          <ShieldCheck size={14} /> Your account details are securely protected.
        </small>
      </form>
    </main>
  );
}
function GoogleAuthCallback({ setUser }) {
  const nav = useNavigate();
  const [message, setMessage] = useState("Completing Google sign-in...");

  useEffect(() => {
    if (!supabase) {
      setMessage(
        "Google sign-in failed: Supabase is not configured for this deployment. Please return to login.",
      );
      return;
    }

    let cancelled = false;

    async function completeSignIn() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const accessToken = data.session?.access_token;
        if (!accessToken) {
          throw new Error("No Google session was found.");
        }

        const result = await request("/auth/google", {
          method: "POST",
          body: JSON.stringify({ accessToken }),
        });

        if (!result.token || !result.user) {
          throw new Error("Account authentication failed.");
        }

        if (cancelled) return;

        localStorage.setItem("staynest_token", result.token);
        setUser(result.user);
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        nav(result.user.role === "admin" ? "/admin" : "/dashboard", {
          replace: true,
        });
      } catch {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        if (!cancelled) {
          setMessage(
            "Google sign-in failed. Please return to login and try again.",
          );
        }
      }
    }

    completeSignIn();
    return () => {
      cancelled = true;
    };
  }, [nav, setUser]);

  return (
    <main className="auth-page">
      <div className="auth-form">
        <Link to="/" className="brand">
          <span>staynest</span>
        </Link>
        <h1>Google sign-in</h1>
        <p>{message}</p>
        {message.startsWith("Google sign-in failed") && (
          <Link className="primary-btn" to="/login">
            Return to login
          </Link>
        )}
      </div>
    </main>
  );
}

function Details({ user }) {
  const { id } = useParams(),
    [a, setA] = useState(null),
    [err, setErr] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [guestName, setGuestName] = useState(""),
    [guestEmail, setGuestEmail] = useState(""),
    [guests, setGuests] = useState(1),
    [policyAccepted, setPolicyAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [paymentUrl, setPaymentUrl] = useState("");
  const nights =
    start && end
      ? Math.max(0, (Date.parse(end) - Date.parse(start)) / 86400000)
      : 0;
  useEffect(() => {
    request("/apartments/" + id)
      .then((d) => setA(d.apartment))
      .catch((e) => setErr(e.message));
  }, [id]);
  async function book(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setPaymentUrl("");
    try {
      const d = await request("/payments/initialize", {
        method: "POST",
        body: JSON.stringify({
          apartmentId: Number(id),
          checkIn: start,
          checkOut: end,
          guests: Number(guests),
          policyAccepted,
          ...(!user ? { guestName, guestEmail } : {}),
        }),
      });
      if (!d.authorization_url)
        throw new Error("Payment checkout could not be opened.");
      if (d.email_sent) {
        window.location.assign(d.authorization_url);
      } else {
        setPaymentUrl(d.authorization_url);
        setMessage(d.email_message || "Your payment link is ready.");
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!a)
    return (
      <main className="section detail-loading">
        {err || "Loading apartment…"}
      </main>
    );
  return (
    <main className="section detail-page">
      <Link to="/" className="back-link">
        Back to stays
      </Link>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">
            <span></span> THE STAYNEST COLLECTION
          </div>
          <h1>{a.title}</h1>
          <p>
            {a.address}, {a.city}
          </p>
        </div>
        <div className="detail-price">
          <strong>{money(a.price)}</strong>
          <span>per night</span>
        </div>
      </div>
      <ApartmentImage className="detail-cover" src={a.image} alt={a.title} />
      <div className="detail-layout">
        <div className="detail-copy">
          <h2>Your space, your pace.</h2>
          <p>{a.description}</p>
          <div className="detail-meta">
            <span>{a.bedrooms} bedrooms</span>
            <span>{a.guests} guests</span>
            <span>{a.bathrooms} bathrooms</span>
          </div>
          <h3>Thoughtful essentials</h3>
          <div className="amenities">
            {a.amenities.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
        <form className="booking-box" onSubmit={book}>
          <div className="eyebrow">
            <span></span> MAKE IT YOURS
          </div>
          <h3>Reserve this stay</h3>
          {!user && (
            <p className="guest-checkout-note">
              Book as a guest. No account or login is required.
            </p>
          )}
          <label>
            Check-in
            <input
              type="date"
              required
              value={start}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Check-out
            <input
              type="date"
              required
              value={end}
              min={start || new Date().toISOString().slice(0, 10)}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label>
            Guests
            <select value={guests} onChange={(e) => setGuests(e.target.value)}>
              {Array.from({ length: a.guests }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} guest{i ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
          {!user && (
            <>
              <label>
                Your name
                <input
                  required
                  minLength="2"
                  maxLength="80"
                  autoComplete="name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </label>
              <label>
                Email for booking details
                <input
                  type="email"
                  required
                  maxLength="160"
                  autoComplete="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </label>
            </>
          )}
          {nights > 0 && (
            <div className="booking-total">
              <span>
                {nights} night{nights === 1 ? "" : "s"} · full payment due
              </span>
              <strong>{money(Number(a.price) * nights)}</strong>
            </div>
          )}
          <label className="payment-policy-acceptance">
            <input
              type="checkbox"
              required
              checked={policyAccepted}
              onChange={(e) => setPolicyAccepted(e.target.checked)}
            />
            <span>
              I agree to pay the full amount upfront. Unpaid dates are held for
              30 minutes. Client cancellations after payment are non-refundable,
              except where required by law or when StayNest cannot provide the
              confirmed booking.
            </span>
          </label>
          {message && <div className="notice error">{message}</div>}
          {paymentUrl ? (
            <a className="primary-btn booking-payment-link" href={paymentUrl}>
              Continue to secure payment
            </a>
          ) : (
            <button className="primary-btn" disabled={busy}>
              {busy
                ? "Preparing secure payment…"
                : user
                  ? "Continue to payment"
                  : "Email payment link & continue"}
            </button>
          )}
          <small>
            {paymentUrl
              ? "Your payment link is ready. Complete checkout within 30 minutes to keep these dates."
              : "We will email your payment link before checkout opens."}
          </small>
        </form>
      </div>
    </main>
  );
}
function Dashboard({ user }) {
  const [bookings, setBookings] = useState([]),
    [err, setErr] = useState(""),
    [paying, setPaying] = useState(null);
  async function load() {
    try {
      setBookings((await request("/bookings/mine")).bookings);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function cancel(id) {
    if (!confirm("Cancel this reservation?")) return;
    try {
      await request("/bookings/" + id + "/cancel", { method: "PATCH" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function pay(id) {
    setPaying(id);
    setErr("");
    try {
      const d = await request("/payments/retry/" + id, { method: "POST" });
      if (!d.authorization_url)
        throw new Error("Payment checkout could not be opened.");
      window.location.assign(d.authorization_url);
    } catch (e) {
      setErr(e.message);
      setPaying(null);
    }
  }
  return (
    <main className="section dashboard">
      <div className="eyebrow">
        <span></span> YOUR STAYNEST
      </div>
      <h1>Welcome, {user?.name?.split(" ")[0]}.</h1>
      <p className="muted">
        All your upcoming and previous stays, in one place.
      </p>
      {new URLSearchParams(location.search).get("payment") === "review" && (
        <div className="notice error">
          Payment was received, but the dates need review because the hold
          expired. Please contact StayNest.
        </div>
      )}
      {err && <div className="notice error">{err}</div>}
      <div className="dash-heading">
        <h2>Your reservations</h2>
        <Link to="/" className="text-link">
          Explore more stays
        </Link>
      </div>
      {bookings.length === 0 ? (
        <div className="empty">
          You haven't booked a stay yet. <Link to="/">Explore apartments</Link>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((b) => (
            <article className="booking-row" key={b.id}>
              <ApartmentImage src={b.image} alt="" />
              <div className="booking-row-info">
                <h3>{b.title}</h3>
                <p>
                  {b.city} · {b.check_in} — {b.check_out}
                </p>
                <span className={"status " + b.status}>{b.status}</span>
              </div>
              <strong>{money(b.total)}</strong>
              {b.status === "pending" && (
                <button
                  className="outline-btn"
                  disabled={paying === b.id}
                  onClick={() => pay(b.id)}
                >
                  {paying === b.id ? "Opening checkout…" : "Pay now"}
                </button>
              )}
              {b.status === "confirmed" && (
                <button className="outline-btn" onClick={() => cancel(b.id)}>
                  Cancel
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
const blank = {
  title: "",
  city: "",
  address: "",
  description: "",
  price: "",
  bedrooms: 1,
  bathrooms: 1,
  guests: 2,
  image:
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85",
  amenities: ["Wi-Fi", "Air conditioning"],
  featured: false,
};
function Admin() {
  const [items, setItems] = useState([]),
    [bookings, setBookings] = useState([]),
    [inquiries, setInquiries] = useState([]),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState(null),
    [err, setErr] = useState(""),
    [show, setShow] = useState(false);
  async function load() {
    try {
      const [a, b, c] = await Promise.all([
        request("/admin/apartments"),
        request("/admin/bookings"),
        request("/admin/inquiries"),
      ]);
      setItems(a.apartments);
      setBookings(b.bookings);
      setInquiries(c.inquiries);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function change(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function save(e) {
    e.preventDefault();
    try {
      await request("/apartments" + (editing ? "/" + editing : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          bedrooms: Number(form.bedrooms),
          bathrooms: Number(form.bathrooms),
          guests: Number(form.guests),
        }),
      });
      setForm(blank);
      setEditing(null);
      setShow(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function del(id) {
    if (
      !confirm(
        "Remove this apartment from active listings? Existing paid or cancelled reservation history will be preserved.",
      )
    )
      return;
    try {
      await request("/apartments/" + id, { method: "DELETE" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function restore(id) {
    try {
      await request(`/apartments/${id}/restore`, { method: "PATCH" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="section dashboard">
      <div className="eyebrow">
        <span></span> STAYNEST CONTROL ROOM
      </div>
      <h1>Admin dashboard.</h1>
      <p className="muted">Manage listings and keep an eye on reservations.</p>
      {err && <div className="notice error">{err}</div>}
      <div className="admin-stats">
        <div>
          <span>LISTINGS</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>RESERVATIONS</span>
          <strong>{bookings.length}</strong>
        </div>
        <div>
          <span>CONFIRMED</span>
          <strong>
            {bookings.filter((b) => b.status === "confirmed").length}
          </strong>
        </div>
      </div>
      <div className="dash-heading">
        <h2>Apartment listings</h2>
        <button
          className="dark-btn"
          onClick={() => {
            setEditing(null);
            setForm(blank);
            setShow(!show);
          }}
        >
          <Plus size={16} /> Add apartment
        </button>
      </div>
      {show && (
        <form className="admin-form" onSubmit={save}>
          <h3>{editing ? "Edit apartment" : "New apartment"}</h3>
          <div className="form-grid">
            {[
              ["title", "Title"],
              ["city", "City / area"],
              ["address", "Address"],
              ["price", "Price per night"],
              ["bedrooms", "Bedrooms"],
              ["bathrooms", "Bathrooms"],
              ["guests", "Maximum guests"],
              ["image", "Image URL"],
            ].map(([k, l]) => (
              <label key={k}>
                {l}
                <input
                  required
                  value={form[k]}
                  type={
                    k === "price" ||
                    ["bedrooms", "bathrooms", "guests"].includes(k)
                      ? "number"
                      : "text"
                  }
                  onChange={(e) => change(k, e.target.value)}
                />
              </label>
            ))}
          </div>
          <label>
            Description
            <textarea
              required
              minLength="20"
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          <label>
            Amenities (comma separated)
            <input
              value={form.amenities.join(", ")}
              onChange={(e) =>
                change(
                  "amenities",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => change("featured", e.target.checked)}
            />{" "}
            Featured listing
          </label>
          <button className="primary-btn">Save listing</button>
        </form>
      )}
      <div className="admin-list">
        {items.map((a) => (
          <div key={a.id}>
            <ApartmentImage src={a.image} alt="" />
            <section>
              <strong>
                {a.title} {!a.is_active && "(removed)"}
              </strong>
              <small>
                {a.city} · {money(a.price)}/night
              </small>
            </section>
            {a.is_active ? (
              <>
                <button
                  className="outline-btn"
                  onClick={() => {
                    setEditing(a.id);
                    setForm({ ...a, amenities: a.amenities || [] });
                    setShow(true);
                    window.scrollTo({ top: 450, behavior: "smooth" });
                  }}
                >
                  Edit
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${a.title} from listings`}
                  title="Remove from active listings; keep reservation history"
                  onClick={() => del(a.id)}
                >
                  <Trash2 size={17} />
                </button>
              </>
            ) : (
              <button className="outline-btn" onClick={() => restore(a.id)}>
                Restore
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="dash-heading">
        <h2>Recent reservations</h2>
      </div>
      <div className="admin-list">
        {bookings.map((b) => (
          <div key={b.id}>
            <section>
              <strong>
                {b.title} · {b.name}
              </strong>
              <small>
                {b.email} · {b.check_in} to {b.check_out}
              </small>
            </section>
            <strong>{money(b.total)}</strong>
            <span className={"status " + b.status}>{b.status}</span>
          </div>
        ))}
      </div>
      <div className="dash-heading">
        <h2>Customer enquiries</h2>
      </div>
      <div className="admin-list inquiry-list">
        {inquiries.length === 0 ? (
          <p className="inquiry-empty">No enquiries yet.</p>
        ) : (
          inquiries.map((inquiry) => (
            <article key={inquiry.id}>
              <div className="inquiry-heading">
                <strong>{inquiry.subject}</strong>
                <small>{new Date(inquiry.created_at).toLocaleString()}</small>
              </div>
              <small>
                {inquiry.name} · {inquiry.email}
              </small>
              <p>{inquiry.message}</p>
              <a
                href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Re: ${inquiry.subject}`)}`}
              >
                Reply by email
              </a>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
function BookingResult() {
  const params = new URLSearchParams(location.search);
  const payment = params.get("payment");
  const reference = params.get("reference");
  const [receipt, setReceipt] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    if (payment !== "success" || !reference) return;
    let active = true;
    setLoadingReceipt(true);
    request(`/payments/receipt/${encodeURIComponent(reference)}`)
      .then((data) => {
        if (active) setReceipt(data.receipt);
      })
      .catch((error) => {
        if (active) setReceiptError(error.message);
      })
      .finally(() => {
        if (active) setLoadingReceipt(false);
      });
    return () => {
      active = false;
    };
  }, [payment, reference]);

  const result = {
    success: {
      title: "Your payment is confirmed.",
      message:
        "Your booking is confirmed. Your receipt is below and a copy has been sent to your email.",
    },
    review: {
      title: "Your payment needs review.",
      message:
        "Payment was received after the date hold expired and those dates may have been booked. Contact StayNest so we can resolve your reservation.",
    },
    failed: {
      title: "Payment was not confirmed.",
      message:
        "No booking was confirmed. You can return to the apartment and try booking again.",
    },
  }[payment] || {
    title: "Booking update",
    message: "Return to the apartment page to continue booking.",
  };
  return (
    <main className="section booking-result">
      <div className="eyebrow">
        <span></span> STAYNEST RESERVATION
      </div>
      <h1>{result.title}</h1>
      <p>{result.message}</p>
      {payment === "success" && (
        <section className="receipt" aria-label="Booking receipt">
          {loadingReceipt ? (
            <p role="status">Loading your verified receipt...</p>
          ) : receipt ? (
            <>
              <header className="receipt-header">
                <div>
                  <span className="receipt-kicker">
                    STAYNEST · PAYMENT RECEIPT
                  </span>
                  <h2>Booking #{receipt.id}</h2>
                </div>
                <span className="receipt-status">Paid and confirmed</span>
              </header>
              <dl className="receipt-details">
                <div>
                  <dt>Guest</dt>
                  <dd>{receipt.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{receipt.email}</dd>
                </div>
                <div>
                  <dt>Apartment</dt>
                  <dd>{receipt.apartment}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {receipt.address}, {receipt.city}
                  </dd>
                </div>
                <div>
                  <dt>Check-in</dt>
                  <dd>{receipt.checkIn}</dd>
                </div>
                <div>
                  <dt>Check-out</dt>
                  <dd>{receipt.checkOut}</dd>
                </div>
                <div>
                  <dt>Guests</dt>
                  <dd>{receipt.guests}</dd>
                </div>
                <div>
                  <dt>Payment reference</dt>
                  <dd>{receipt.reference}</dd>
                </div>
                <div>
                  <dt>Paid at</dt>
                  <dd>
                    {receipt.paidAt
                      ? new Date(receipt.paidAt).toLocaleString()
                      : "Verified by Paystack"}
                  </dd>
                </div>
                <div className="receipt-total">
                  <dt>Total paid</dt>
                  <dd>{money(receipt.total)}</dd>
                </div>
              </dl>
              <button
                className="dark-btn receipt-print"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print receipt
              </button>
            </>
          ) : (
            <p className="receipt-error" role="status">
              {receiptError ||
                "A receipt reference was not returned. Check your email or contact StayNest for your booking details."}
            </p>
          )}
        </section>
      )}
      <Link to="/" className="dark-btn">
        Return to stays
      </Link>
    </main>
  );
}
function PrivacyPolicy() {
  return (
    <main className="section privacy-page">
      <div className="eyebrow">
        <span></span> YOUR PRIVACY
      </div>
      <h1>Privacy policy</h1>
      <p className="privacy-updated">Last updated: November 4, 2026</p>
      <p>
        This policy describes how StayNest handles information when you browse
        stays, contact us, subscribe to updates, create an account, or make a
        reservation.
      </p>
      <section>
        <h2>Information we collect</h2>
        <p>
          We collect account details such as your name and email address; guest
          booking contact details; reservation dates, guest count and payment
          status; inquiry messages; and email addresses submitted to the
          newsletter. Passwords are stored as password hashes. Payment card
          details are handled by Paystack and are not stored by StayNest.
        </p>
      </section>
      <section>
        <h2>How we use information</h2>
        <p>
          We use booking details to reserve stays, verify payments, send payment
          links and confirmations, manage reservations, respond to inquiries,
          and manage email addresses people choose to subscribe for updates. We
          also use necessary browser storage to keep you signed in and remember
          your cookie preference.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Paystack processes payments. Resend delivers booking, inquiry and
          payment-link emails. Newsletter addresses are stored by StayNest for
          future updates. These providers process information needed to provide
          their services under their own privacy terms. StayNest does not sell
          personal information.
        </p>
      </section>
      <section>
        <h2>Cookies and browser storage</h2>
        <p>
          StayNest uses local storage for your sign-in token and a first-party
          cookie named staynest_cookie_consent to remember your cookie choice.
          The current site does not use advertising or analytics cookies.
          Clearing browser storage may sign you out or reset your cookie
          preference. Use Cookie settings in the footer to change your choice.
        </p>
      </section>
      <section>
        <h2>Retention and your choices</h2>
        <p>
          We retain information for as long as needed to provide bookings,
          support, and requested email updates, and to meet applicable record
          keeping requirements. You may ask to access or correct your details,
          or request removal from newsletter updates, by contacting StayNest
          through the <Link to="/#contact">enquiry form</Link>.
        </p>
      </section>
      <section>
        <h2>Policy updates</h2>
        <p>
          We may update this policy as the service changes. The date at the top
          indicates when it was last revised.
        </p>
      </section>
    </main>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (localStorage.getItem("staynest_token"))
      request("/auth/me")
        .then((d) => setUser(d.user))
        .catch(() => {
          localStorage.removeItem("staynest_token");
        });
  }, []);
  return (
    <>
      <Nav user={user} setUser={setUser} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/book" element={<BookingBrowse />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route
          path="/login"
          element={<Auth mode="login" setUser={setUser} />}
        />
        <Route
          path="/register"
          element={<Auth mode="register" setUser={setUser} />}
        />
        <Route
          path="/auth/callback"
          element={<GoogleAuthCallback setUser={setUser} />}
        />
        <Route path="/apartments/:id" element={<Details user={user} />} />
        <Route path="/booking-result" element={<BookingResult />} />
        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard user={user} />
            ) : (
              <Auth mode="login" setUser={setUser} />
            )
          }
        />
        <Route
          path="/admin"
          element={
            user?.role === "admin" ? (
              <Admin />
            ) : (
              <Auth mode="login" setUser={setUser} />
            )
          }
        />
        <Route
          path="*"
          element={
            <main className="section">
              <h1>Page not found</h1>
              <Link to="/">Return home</Link>
            </main>
          }
        />
      </Routes>
      <Footer />
      <CookieConsent />
    </>
  );
}
