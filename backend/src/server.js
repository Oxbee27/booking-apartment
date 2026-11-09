import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET;
if (!SECRET && process.env.NODE_ENV === "production")
  throw new Error("JWT_SECRET is required in production");
const jwtSecret = SECRET || "local-development-secret-change-me";
app.use(helmet());
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://booking-apartment-o3rt.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "20kb" }));
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
function escapeHtml(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}
function getResendFromEmail() {
  return [process.env.RESEND_FROM_EMAIL, process.env.EMAIL_FROM].find(
    (value) => {
      if (!value) return false;
      const sender = value.trim();
      const match = sender.match(/^(?:[^<>]*<([^<>]+)>|([^<>]+))$/);
      const address = (match?.[1] || match?.[2] || "").trim();
      return /^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(address);
    },
  );
}
const auth = (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Please sign in." });
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Your session is invalid or expired." });
  }
};
const optionalAuth = (req, res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return next();
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    next();
  }
};
const admin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ message: "Administrator access required." });
const issue = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: "2h" },
  );
const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(72),
});
const apartmentSchema = z.object({
  title: z.string().min(3).max(120),
  city: z.string().min(2),
  address: z.string().min(3),
  description: z.string().min(20),
  price: z.coerce.number().positive(),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().int().min(1),
  guests: z.coerce.number().int().min(1),
  image: z.string().url(),
  amenities: z.array(z.string()).default([]),
  featured: z.coerce.boolean().default(false),
});
const inquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});
const newsletterSchema = z.object({
  email: z.string().trim().email().max(160),
  consent: z.literal(true),
});
async function sendResendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  idempotencyKey,
}) {
  const maxAttempts = idempotencyKey ? 2 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: getResendFromEmail(),
          to: [to],
          subject,
          text,
          ...(html ? { html } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) return;

      const error = new Error(
        result.message || "Resend could not deliver the email.",
      );
      if (
        attempt < maxAttempts &&
        (response.status === 429 || response.status >= 500)
      )
        continue;
      throw error;
    } catch (error) {
      if (
        attempt < maxAttempts &&
        (error.name === "TypeError" || error.name === "TimeoutError")
      )
        continue;
      const causeCode = error.cause?.code;
      if (causeCode) {
        throw new Error(`${error.message} (${causeCode})`, { cause: error });
      }
      throw error;
    }
  }
}
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "StayNest API" }),
);
app.post(
  "/api/newsletter/subscribe",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  wrap(async (req, res) => {
    const subscription = newsletterSchema.parse(req.body);
    await db.query(
      `INSERT INTO newsletter_subscribers(email) VALUES($1)
       ON CONFLICT(email) DO UPDATE SET consented_at = NOW()`,
      [subscription.email.toLowerCase()],
    );
    res.status(201).json({ message: "You're subscribed to StayNest updates." });
  }),
);
app.post(
  "/api/inquiries",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  wrap(async (req, res) => {
    if (
      !process.env.RESEND_API_KEY ||
      !getResendFromEmail() ||
      !process.env.INQUIRY_NOTIFY_EMAIL
    )
      return res.status(503).json({
        message:
          "Email is not configured yet. Please contact StayNest directly or try again later.",
      });
    const inquiry = inquirySchema.parse(req.body);
    await db
      .prepare(
        "INSERT INTO inquiries(name,email,subject,message) VALUES(?,?,?,?)",
      )
      .run(
        inquiry.name,
        inquiry.email.toLowerCase(),
        inquiry.subject,
        inquiry.message,
      );
    const safeSubject = inquiry.subject.replace(/[\r\n]/g, " ");
    const notification = sendResendEmail({
      to: process.env.INQUIRY_NOTIFY_EMAIL,
      subject: `New StayNest enquiry: ${safeSubject}`,
      replyTo: inquiry.email,
      text: `New customer enquiry\n\nFrom: ${inquiry.name}\nEmail: ${inquiry.email}\nSubject: ${safeSubject}\n\n${inquiry.message}`,
    });
    const acknowledgement = sendResendEmail({
      to: process.env.INQUIRY_NOTIFY_EMAIL,
      subject: `We received your StayNest enquiry: ${safeSubject}`,
      text: `Hi ${inquiry.name},\n\nThanks for contacting StayNest. We received your message and our team will get back to you by email.\n\nYour enquiry: ${safeSubject}\n\nStayNest Support`,
    });
    const delivery = await Promise.allSettled([notification, acknowledgement]);
    if (delivery.some((result) => result.status === "rejected")) {
      console.error(
        "Resend delivery failed:",
        delivery
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason.message),
      );
      return res.status(502).json({
        message:
          "Your enquiry was saved, but email delivery failed. Please try again later.",
      });
    }
    res.status(201).json({ message: "Your enquiry has been sent." });
  }),
);
app.post(
  "/api/auth/google",
  wrap(async (req, res) => {
    const accessToken = req.body?.accessToken;

    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return res.status(400).json({
        message: "Google sign-in could not be completed. Please try again.",
      });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      return res.status(503).json({
        message: "Google sign-in is temporarily unavailable.",
      });
    }

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase.auth.getUser(accessToken);
    const googleUser = data?.user;

    const isGoogle =
      googleUser?.app_metadata?.provider === "google" ||
      googleUser?.identities?.some((identity) => identity.provider === "google");

    if (error || !isGoogle || !googleUser?.email || !googleUser.email_confirmed_at) {
      return res.status(401).json({
        message: "Google account verification failed. Please try again.",
      });
    }

    const email = googleUser.email.trim().toLowerCase();
    const name = String(
      googleUser.user_metadata?.full_name ||
      googleUser.user_metadata?.name ||
      email.split("@")[0]
    ).trim().slice(0, 80);

    const passwordHash = await bcrypt.hash(
      randomBytes(48).toString("hex"),
      12
    );

    const result = await db.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       ON CONFLICT (email)
       DO UPDATE SET email = users.email
       RETURNING id, name, email, role`,
      [name || email.split("@")[0], email, passwordHash]
    );

    const user = result.rows[0];

    res.json({
      token: issue(user),
      user: safeUser(user),
    });
  }),
);

app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const p = registerSchema.parse(req.body);
    const email = p.email.toLowerCase();
    if (await db.prepare("SELECT id FROM users WHERE email=?").get(email))
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    const info = await db
      .prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)")
      .run(p.name, email, await bcrypt.hash(p.password, 12));
    const u = await db
      .prepare("SELECT id,name,email,role FROM users WHERE id=?")
      .get(info.lastInsertRowid);
    res.status(201).json({ token: issue(u), user: safeUser(u) });
  }),
);
app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const p = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const u = await db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(p.email.toLowerCase());
    if (!u || !(await bcrypt.compare(p.password, u.password)))
      return res.status(401).json({ message: "Incorrect email or password." });
    res.json({ token: issue(u), user: safeUser(u) });
  }),
);
app.get(
  "/api/auth/me",
  auth,
  wrap(async (req, res) => {
    const u = await db
      .prepare("SELECT id,name,email,role FROM users WHERE id=?")
      .get(req.user.id);
    u
      ? res.json({ user: u })
      : res.status(401).json({ message: "Account not found." });
  }),
);
app.get(
  "/api/apartments",
  wrap(async (req, res) => {
    const { q = "", city = "", min = "", max = "", guests = "" } = req.query;
    let sql = "SELECT * FROM apartments WHERE is_active=TRUE",
      args = [];
    if (q) {
      sql +=
        " AND (title ILIKE ? OR description ILIKE ? OR city ILIKE ? OR amenities::text ILIKE ?)";
      args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (city) {
      sql += " AND city ILIKE ?";
      args.push(`%${city}%`);
    }
    if (min) {
      sql += " AND price>=?";
      args.push(Number(min));
    }
    if (max) {
      sql += " AND price<=?";
      args.push(Number(max));
    }
    if (guests) {
      sql += " AND guests>=?";
      args.push(Number(guests));
    }
    sql += " ORDER BY featured DESC,created_at DESC";
    res.json({
      apartments: await db.prepare(sql).all(...args),
    });
  }),
);
app.get(
  "/api/admin/apartments",
  auth,
  admin,
  wrap(async (req, res) => {
    res.json({
      apartments: await db
        .prepare(
          "SELECT * FROM apartments ORDER BY is_active DESC,featured DESC,created_at DESC",
        )
        .all(),
    });
  }),
);
app.get(
  "/api/apartments/:id",
  wrap(async (req, res) => {
    const a = await db
      .prepare("SELECT * FROM apartments WHERE id=? AND is_active=TRUE")
      .get(req.params.id);
    if (!a) return res.status(404).json({ message: "Apartment not found." });
    res.json({ apartment: a });
  }),
);
app.post(
  "/api/apartments",
  auth,
  admin,
  wrap(async (req, res) => {
    const p = apartmentSchema.parse(req.body);
    const r = await db
      .prepare(
        "INSERT INTO apartments(title,city,address,description,price,bedrooms,bathrooms,guests,image,amenities,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        p.title,
        p.city,
        p.address,
        p.description,
        p.price,
        p.bedrooms,
        p.bathrooms,
        p.guests,
        p.image,
        JSON.stringify(p.amenities),
        p.featured,
      );
    res
      .status(201)
      .json({ id: r.lastInsertRowid, message: "Apartment created." });
  }),
);
app.put(
  "/api/apartments/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const p = apartmentSchema.parse(req.body);
    const r = await db
      .prepare(
        "UPDATE apartments SET title=?,city=?,address=?,description=?,price=?,bedrooms=?,bathrooms=?,guests=?,image=?,amenities=?,featured=? WHERE id=?",
      )
      .run(
        p.title,
        p.city,
        p.address,
        p.description,
        p.price,
        p.bedrooms,
        p.bathrooms,
        p.guests,
        p.image,
        JSON.stringify(p.amenities),
        p.featured,
        req.params.id,
      );
    r.changes
      ? res.json({ message: "Apartment updated." })
      : res.status(404).json({ message: "Apartment not found." });
  }),
);
app.delete(
  "/api/apartments/:id",
  auth,
  admin,
  wrap(async (req, res) => {
    const r = await db
      .prepare(
        "UPDATE apartments SET is_active=FALSE WHERE id=? AND is_active=TRUE",
      )
      .run(req.params.id);
    r.changes
      ? res.json({
          message:
            "Apartment removed from active listings. Reservation history was kept.",
        })
      : res.status(404).json({ message: "Active apartment not found." });
  }),
);
app.patch(
  "/api/apartments/:id/restore",
  auth,
  admin,
  wrap(async (req, res) => {
    const r = await db
      .prepare(
        "UPDATE apartments SET is_active=TRUE WHERE id=? AND is_active=FALSE",
      )
      .run(req.params.id);
    r.changes
      ? res.json({ message: "Apartment restored to active listings." })
      : res.status(404).json({ message: "Removed apartment not found." });
  }),
);
const bookingSchema = z.object({
  apartmentId: z.coerce.number().int().positive(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1),
  policyAccepted: z
    .boolean()
    .refine(Boolean, "Accept the payment policy to continue."),
  guestName: z.string().trim().min(2).max(80).optional(),
  guestEmail: z.string().trim().email().max(160).optional(),
});
const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
const paymentPolicyVersion = "2026-11-v1";

async function verifyPaystackPayment(reference) {
  if (!paystackSecret) {
    throw new Error("Paystack is not configured.");
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
      signal: AbortSignal.timeout(15000),
    },
  );

  const result = await response.json().catch(() => ({}));
  const payment = result.data;

  if (
    !response.ok ||
    !result.status ||
    payment?.status !== "success" ||
    payment?.reference !== reference
  ) {
    throw new Error("Payment could not be verified.");
  }

  const booking = await db
    .prepare(
      `
      SELECT
        b.*,
        COALESCE(b.guest_email, u.email) AS email,
        COALESCE(b.guest_name, u.name) AS name,
        a.title AS apartment_title,
        a.city,
        a.address
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      JOIN apartments a ON a.id = b.apartment_id
      WHERE b.payment_reference = ?
    `,
    )
    .get(reference);

  if (!booking) {
    throw new Error("Booking not found for this payment.");
  }

  if (
    Number(payment.amount) !== Math.round(Number(booking.total) * 100) ||
    payment.currency !== "NGN"
  ) {
    throw new Error("Payment amount or currency does not match the booking.");
  }

  const updated = await db.query(
    `
    UPDATE bookings AS booking
    SET status = CASE
      WHEN EXISTS (
        SELECT 1
        FROM bookings AS other
        WHERE other.apartment_id = booking.apartment_id
          AND other.id <> booking.id
          AND (
            other.status = 'confirmed'
            OR (other.status = 'pending' AND other.hold_expires_at > NOW())
          )
          AND other.check_in < booking.check_out
          AND other.check_out > booking.check_in
      ) THEN 'payment_review'
      ELSE 'confirmed'
    END
    WHERE booking.id = ? AND booking.status IN ('pending', 'expired', 'payment_failed')
    RETURNING status
  `,
    [booking.id],
  );
  const paymentStatus =
    updated.rows[0]?.status ||
    (await db.prepare("SELECT status FROM bookings WHERE id=?").get(booking.id))
      ?.status;
  if (!paymentStatus) throw new Error("Booking status could not be updated.");
  if (paymentStatus === "payment_review") {
    console.error(
      `Booking ${booking.id} was paid after its dates were rebooked.`,
    );
  }

  // Do not attempt to send if email configuration is incomplete.
  if (
    paymentStatus === "confirmed" &&
    process.env.RESEND_API_KEY &&
    getResendFromEmail() &&
    booking.email
  ) {
    // Atomic claim prevents concurrent requests sending duplicate emails.
    const claim = await db.query(
      `
      UPDATE bookings
      SET confirmation_email_claimed_at = NOW()
      WHERE id = ?
        AND confirmation_email_sent_at IS NULL
        AND confirmation_email_claimed_at IS NULL
      RETURNING id
    `,
      [booking.id],
    );

    if (claim.rows.length > 0) {
      try {
        await sendResendEmail({
          to: booking.email,
          subject: `StayNest payment receipt - booking ${booking.id}`,
          text: `
Hello ${booking.name || "Customer"},

Your payment has been successfully verified. This is your StayNest booking receipt.

PAYMENT RECEIPT

Booking ID: ${booking.id}
Payment reference: ${booking.payment_reference}
Status: ${paymentStatus === "confirmed" ? "Paid and confirmed" : "Payment received - booking under review"}
Apartment: ${booking.apartment_title}
Location: ${booking.city}
Address: ${booking.address}
Check-in: ${booking.check_in}
Check-out: ${booking.check_out}
Guests: ${booking.guests}
Total paid: NGN ${Number(booking.total).toLocaleString("en-NG")}

Please keep this receipt for your records. Thank you for choosing StayNest.

StayNest Reservations Team
          `.trim(),
        });

        await db
          .prepare(
            `
            UPDATE bookings
            SET confirmation_email_sent_at = NOW()
            WHERE id = ?
          `,
          )
          .run(booking.id);

        console.log(
          `Booking confirmation email sent for booking ${booking.id}`,
        );
      } catch (error) {
        // Release failed claim so a later verification can retry.
        await db
          .prepare(
            `
            UPDATE bookings
            SET confirmation_email_claimed_at = NULL
            WHERE id = ?
              AND confirmation_email_sent_at IS NULL
          `,
          )
          .run(booking.id);

        console.error(
          `Booking ${booking.id} confirmation email failed:`,
          error.message,
        );
      }
    }
  } else if (paymentStatus === "confirmed") {
    console.warn(
      `Booking ${booking.id} confirmed, but email configuration or customer email is missing.`,
    );
  }

  return { ...booking, status: paymentStatus, paid_at: payment.paid_at };
}

app.post(
  "/api/payments/initialize",
  optionalAuth,
  wrap(async (req, res) => {
    if (!paystackSecret)
      return res.status(503).json({
        message:
          "Payments are not configured. Set PAYSTACK_SECRET_KEY on the backend.",
      });
    const p = bookingSchema.parse(req.body);
    if (!req.user && (!p.guestName || !p.guestEmail))
      return res.status(400).json({
        message: "Enter your name and email to book without an account.",
      });
    const start = new Date(p.checkIn + "T00:00:00Z"),
      end = new Date(p.checkOut + "T00:00:00Z"),
      today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (
      Number.isNaN(+start) ||
      Number.isNaN(+end) ||
      start < today ||
      end <= start
    )
      return res
        .status(400)
        .json({ message: "Choose valid future check-in and check-out dates." });
    const a = await db
      .prepare("SELECT * FROM apartments WHERE id=? AND is_active=TRUE")
      .get(p.apartmentId);
    if (!a) return res.status(404).json({ message: "Apartment not found." });
    if (p.guests > a.guests)
      return res.status(400).json({
        message: `This apartment accommodates up to ${a.guests} guests.`,
      });
    await db
      .prepare(
        "UPDATE bookings SET status='expired' WHERE status='pending' AND hold_expires_at <= NOW()",
      )
      .run();
    const conflict = await db
      .prepare(
        "SELECT id FROM bookings WHERE apartment_id=? AND (status='confirmed' OR (status='pending' AND hold_expires_at > NOW())) AND check_in < ? AND check_out > ?",
      )
      .get(a.id, p.checkOut, p.checkIn);
    if (conflict)
      return res.status(409).json({
        message:
          "These dates are not available. Please choose different dates.",
      });
    const nights = (end - start) / 86400000,
      total = nights * a.price,
      reference = `staynest-${randomUUID()}`,
      user = req.user
        ? await db
            .prepare("SELECT email FROM users WHERE id=?")
            .get(req.user.id)
        : null,
      customerEmail = user?.email || p.guestEmail,
      customerName = req.user?.name || p.guestName;
    if (req.user && !user)
      return res
        .status(401)
        .json({ message: "Your account could not be found." });
    const booking = await db
      .prepare(
        "INSERT INTO bookings(user_id,apartment_id,check_in,check_out,guests,total,status,payment_reference,guest_name,guest_email,payment_policy_accepted_at,payment_policy_version,hold_expires_at) VALUES(?,?,?,?,?,?,'pending',?,?,?,NOW(),?,NOW() + INTERVAL '30 minutes')",
      )
      .run(
        req.user?.id || null,
        a.id,
        p.checkIn,
        p.checkOut,
        p.guests,
        total,
        reference,
        customerName,
        customerEmail,
        paymentPolicyVersion,
      );
    let paymentUrl;
    try {
      const response = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: customerEmail,
            amount: Math.round(total * 100),
            currency: "NGN",
            reference,
            callback_url: `${process.env.API_URL || `http://localhost:${PORT}`}/api/payments/callback`,
            metadata: {
              booking_id: Number(booking.lastInsertRowid),
              ...(req.user ? { user_id: req.user.id } : {}),
            },
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.status || !result.data?.authorization_url)
        throw new Error(
          result.message || "Paystack could not initialize this payment.",
        );
      paymentUrl = result.data.authorization_url;
    } catch (error) {
      await db
        .prepare("UPDATE bookings SET status='payment_failed' WHERE id=?")
        .run(booking.lastInsertRowid);
      console.error("Paystack initialization failed:", error.message);
      return res.status(502).json({
        message: `Paystack could not create your payment link: ${error.message}. No payment was taken and your date hold was released.`,
      });
    }

    let emailSent = false;
    let emailMessage = "";
    if (
      process.env.RESEND_API_KEY &&
      getResendFromEmail() &&
      !/onboarding@resend\.dev/i.test(getResendFromEmail())
    ) {
      const safeName = escapeHtml(customerName || "there");
      const safeTitle = escapeHtml(a.title);
      const safeLocation = escapeHtml(`${a.address}, ${a.city}`);
      const safeCheckIn = escapeHtml(p.checkIn);
      const safeCheckOut = escapeHtml(p.checkOut);
      const safePaymentUrl = escapeHtml(paymentUrl);
      try {
        await sendResendEmail({
          to: customerEmail,
          subject: "Complete your StayNest booking payment",
          idempotencyKey: `payment-link/${booking.lastInsertRowid}`,
          text: `Hello ${customerName || "there"},\n\nYour reservation request is ready. Complete payment within 30 minutes to hold your dates.\n\nApartment: ${a.title}\nLocation: ${a.address}, ${a.city}\nCheck-in: ${p.checkIn}\nCheck-out: ${p.checkOut}\nGuests: ${p.guests}\nTotal due: NGN ${Number(total).toLocaleString("en-NG")}\n\nComplete your payment here:\n${paymentUrl}\n\nIf you did not request this reservation, you can ignore this email.`,
          html: `<p>Hello ${safeName},</p><p>Your reservation request is ready. Complete payment within 30 minutes to hold your dates.</p><ul><li><strong>Apartment:</strong> ${safeTitle}</li><li><strong>Location:</strong> ${safeLocation}</li><li><strong>Check-in:</strong> ${safeCheckIn}</li><li><strong>Check-out:</strong> ${safeCheckOut}</li><li><strong>Guests:</strong> ${p.guests}</li><li><strong>Total due:</strong> NGN ${Number(total).toLocaleString("en-NG")}</li></ul><p><a href="${safePaymentUrl}">Complete your payment</a></p><p>If you did not request this reservation, you can ignore this email.</p>`,
        });
        emailSent = true;
      } catch (error) {
        console.error("Payment link email failed:", error.message);
        emailMessage =
          "We couldn't email your payment link. Your dates are held for 30 minutes; continue securely using the button below.";
      }
    } else {
      emailMessage =
        "Email delivery is unavailable right now. Your dates are held for 30 minutes; continue securely using the button below.";
    }
    res.status(201).json({
      authorization_url: paymentUrl,
      email_sent: emailSent,
      email_message: emailMessage,
      reference,
      booking: {
        id: Number(booking.lastInsertRowid),
        total,
        nights,
        holdMinutes: 30,
      },
    });
  }),
);
app.post(
  "/api/payments/retry/:id",
  auth,
  wrap(async (req, res) => {
    if (!paystackSecret)
      return res.status(503).json({ message: "Payments are not configured." });
    const booking = await db
      .prepare(
        "SELECT b.*,u.email FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.id=? AND b.user_id=?",
      )
      .get(req.params.id, req.user.id);
    if (!booking)
      return res.status(404).json({ message: "Reservation not found." });
    if (
      booking.hold_expires_at &&
      new Date(booking.hold_expires_at) <= new Date()
    ) {
      await db
        .prepare(
          "UPDATE bookings SET status='expired' WHERE id=? AND status='pending'",
        )
        .run(booking.id);
      return res.status(409).json({
        message:
          "The 30-minute payment window expired. Please start a new reservation.",
      });
    }
    if (booking.status !== "pending")
      return res
        .status(409)
        .json({ message: "Only pending reservations can be paid." });

    const reference = `staynest-${randomUUID()}`;
    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: booking.email,
          amount: Math.round(Number(booking.total) * 100),
          currency: "NGN",
          reference,
          callback_url: `${process.env.API_URL || `http://localhost:${PORT}`}/api/payments/callback`,
          metadata: {
            booking_id: Number(booking.id),
            user_id: req.user.id,
          },
        }),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.status || !result.data?.authorization_url)
      return res.status(502).json({
        message:
          result.message || "Paystack could not initialize this payment.",
      });
    const updated = await db
      .prepare(
        "UPDATE bookings SET payment_reference=? WHERE id=? AND user_id=? AND status='pending'",
      )
      .run(reference, booking.id, req.user.id);
    if (!updated.changes)
      return res
        .status(409)
        .json({ message: "This reservation is no longer pending." });
    res.json({ authorization_url: result.data.authorization_url, reference });
  }),
);
app.get(
  "/api/payments/callback",
  wrap(async (req, res) => {
    const parsed = z.string().min(1).safeParse(req.query.reference);
    let outcome = "failed";
    let isGuest = false;
    if (parsed.success && paystackSecret) {
      try {
        const verified = await verifyPaystackPayment(parsed.data);
        isGuest = !verified.user_id;
        outcome = verified.status === "payment_review" ? "review" : "success";
      } catch (error) {
        console.error("Paystack callback verification failed:", error.message);
        const booking = await db
          .prepare("SELECT user_id FROM bookings WHERE payment_reference=?")
          .get(parsed.data);
        isGuest = booking?.user_id == null;
      }
    }
    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/${isGuest ? "booking-result" : "dashboard"}?payment=${outcome}${parsed.success ? `&reference=${encodeURIComponent(parsed.data)}` : ""}`,
    );
  }),
);
app.get(
  "/api/payments/receipt/:reference",
  wrap(async (req, res) => {
    if (!paystackSecret)
      return res.status(503).json({ message: "Payments are not configured." });
    const verified = await verifyPaystackPayment(req.params.reference);
    if (verified.status !== "confirmed")
      return res.status(409).json({
        message:
          "Payment was received, but the booking is under review. Please contact StayNest for assistance.",
        status: verified.status,
      });
    res.set("Cache-Control", "no-store");
    res.json({
      receipt: {
        id: verified.id,
        reference: verified.payment_reference,
        status: verified.status,
        name: verified.name,
        email: verified.email,
        apartment: verified.apartment_title,
        city: verified.city,
        address: verified.address,
        checkIn: verified.check_in,
        checkOut: verified.check_out,
        guests: verified.guests,
        total: verified.total,
        paidAt: verified.paid_at,
      },
    });
  }),
);
app.get(
  "/api/payments/verify/:reference",
  auth,
  wrap(async (req, res) => {
    if (!paystackSecret)
      return res.status(503).json({ message: "Payments are not configured." });
    const booking = await db
      .prepare("SELECT * FROM bookings WHERE payment_reference=? AND user_id=?")
      .get(req.params.reference, req.user.id);
    if (!booking)
      return res.status(404).json({ message: "Payment reference not found." });
    const verified = await verifyPaystackPayment(req.params.reference);
    res.json({
      message:
        verified.status === "payment_review"
          ? "Payment received, but the dates need review. Please contact StayNest."
          : "Payment verified.",
      booking: {
        id: verified.id,
        status: verified.status,
        total: verified.total,
      },
    });
  }),
);
app.post("/api/bookings", auth, (req, res) =>
  res.status(402).json({
    message:
      "Payment is required. Start checkout at POST /api/payments/initialize.",
  }),
);
app.get(
  "/api/bookings/mine",
  auth,
  wrap(async (req, res) => {
    res.json({
      bookings: await db
        .prepare(
          `SELECT b.*, CASE WHEN b.status='pending' AND b.hold_expires_at <= NOW() THEN 'expired' ELSE b.status END AS status,a.title,a.city,a.image FROM bookings b JOIN apartments a ON a.id=b.apartment_id WHERE b.user_id=? ORDER BY b.created_at DESC`,
        )
        .all(req.user.id),
    });
  }),
);
app.patch(
  "/api/bookings/:id/cancel",
  auth,
  wrap(async (req, res) => {
    const r = await db
      .prepare(
        "UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=? AND status='confirmed'",
      )
      .run(req.params.id, req.user.id);
    r.changes
      ? res.json({ message: "Booking cancelled." })
      : res.status(404).json({ message: "Active booking not found." });
  }),
);
app.get(
  "/api/admin/bookings",
  auth,
  admin,
  wrap(async (req, res) => {
    res.json({
      bookings: await db
        .prepare(
          `SELECT b.*,COALESCE(b.guest_name,u.name) AS name,COALESCE(b.guest_email,u.email) AS email,a.title,a.city FROM bookings b LEFT JOIN users u ON u.id=b.user_id JOIN apartments a ON a.id=b.apartment_id ORDER BY b.created_at DESC`,
        )
        .all(),
    });
  }),
);
app.get(
  "/api/admin/inquiries",
  auth,
  admin,
  wrap(async (req, res) => {
    res.json({
      inquiries: await db
        .prepare(
          "SELECT id,name,email,subject,message,created_at FROM inquiries ORDER BY created_at DESC LIMIT 100",
        )
        .all(),
    });
  }),
);
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError)
    return res.status(400).json({
      message: "Please check the submitted information.",
      errors: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  if (err.code === "23505")
    return res.status(409).json({ message: "This record already exists." });
  console.error(err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});
app.listen(PORT, () =>
  console.log(`StayNest API running on http://localhost:${PORT}`),
);
