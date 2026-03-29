import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";

export const billingRouter: Router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia" as any,
});

const FRONTEND_URL = process.env.FRONTEND_URL || "https://sitwithyou.app";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Sit With You <hello@sitwithyou.app>";

// ── helpers ──────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY not set");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[email] Resend error:", res.status, err);
  } else {
    console.log("[email] sent to:", to, "subject:", subject);
  }
}

async function invalidateTokensForEmail(email: string) {
  await prisma.magicToken.updateMany({
    where: { email, used: false },
    data: { used: true, expiresAt: new Date() },
  });
}

// ── POST /api/billing/create-checkout ────────────────────────────────────

billingRouter.post("/create-checkout", async (req: Request, res: Response) => {
  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) return res.status(500).json({ error: "Stripe not configured" });

    // Try to get session for email pre-fill, but don't require it
    const sessionId =
      req.signedCookies?.sh_session ||
      req.cookies?.sh_session ||
      req.body?.sessionId;
    let customerEmail: string | undefined;
    let session: any = null;
    if (sessionId) {
      session = await prisma.session.findUnique({ where: { id: sessionId } });
      customerEmail = session?.email || undefined;
    }

    // Duplicate signup check: if user is already PAID, send them to the portal instead
    if (session?.tier === 'PAID') {
      console.log('[billing] user already PAID, redirecting to portal instead');
      try {
        if (session.subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(session.subscriptionId);
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: sub.customer as string,
            return_url: `${process.env.FRONTEND_URL || 'https://sitwithyou.app'}/`,
          });
          return res.json({ url: portalSession.url });
        }
      } catch (err) {
        console.error('[billing] portal fallback error:', err);
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/?upgraded=true`,
      cancel_url: `${FRONTEND_URL}/upgrade?cancelled=true`,
      metadata: { sessionId: sessionId || "anonymous" },
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });

    console.log("[billing] checkout session created:", checkoutSession.id);
    return res.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[billing] create-checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout" });
  }
});

// ── POST /api/billing/webhook ─────────────────────────────────────────────

export async function billingWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(
      "[billing] webhook signature verification failed:",
      err.message
    );
    return res.status(400).send("Invalid signature");
  }

  console.log("[billing] webhook event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        try {
          const checkout = event.data.object as any;
          const metaSessionId = checkout.metadata?.sessionId;
          const email = checkout.customer_email || checkout.customer_details?.email || "";
          const subscriptionId = (checkout.subscription as string) || "";

          let session = null;

          // Try find by metadata sessionId
          if (metaSessionId && metaSessionId !== "anonymous") {
            session = await prisma.session.findUnique({ where: { id: metaSessionId } }).catch(() => null);
          }

          // Fallback: find by email
          if (!session && email) {
            session = await prisma.session.findFirst({ where: { email } }).catch(() => null);
          }

          // Last resort: create new session
          if (!session) {
            session = await prisma.session.create({
              data: {
                tier: "PAID",
                subscriptionId,
                ...(email ? { email, emailVerified: true } : {}),
              },
            });
            console.log("[billing] created new PAID session:", session.id);
          } else {
            await prisma.session.update({
              where: { id: session.id },
              data: {
                tier: "PAID",
                subscriptionId,
                ...(email ? { email, emailVerified: true } : {}),
              },
            });
            console.log("[billing] upgraded session to PAID:", session.id);
          }

          // Send welcome email
          if (email) {
            await sendEmail(
              email,
              "Welcome to Sit With You",
              `<p style="font-family: -apple-system, system-ui, sans-serif; color: #e2e8f0;">Hi,</p>
              <p style="font-family: -apple-system, system-ui, sans-serif; color: #e2e8f0;">Thanks for choosing to sit with us. Your subscription is now active.</p>
              <p style="font-family: -apple-system, system-ui, sans-serif; color: #e2e8f0;">You can start a call anytime at <a href="https://sitwithyou.app" style="color: #86efac;">sitwithyou.app</a>.</p>
              <p style="font-family: -apple-system, system-ui, sans-serif; color: #e2e8f0;">To manage or cancel your subscription, just reply to this email.</p>
              <p style="font-family: -apple-system, system-ui, sans-serif; color: #94a3b8; font-size: 12px; margin-top: 24px;">By subscribing you agree to our <a href="https://sitwithyou.app/terms" style="color: #94a3b8;">Terms of Service</a> and <a href="https://sitwithyou.app/privacy" style="color: #94a3b8;">Privacy Policy</a>.</p>
              <p style="font-family: -apple-system, system-ui, sans-serif; color: #e2e8f0;">Take care,<br/>Sit With You</p>`
            ).catch(err => console.error("[email] welcome email failed:", err));
          }
        } catch (err) {
          console.error("[billing] checkout handler error:", err);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const session = await prisma.session.findFirst({
          where: { subscriptionId: sub.id },
        });
        if (session) {
          const isActive =
            sub.status === "active" || sub.status === "trialing";
          await prisma.session.update({
            where: { id: session.id },
            data: { tier: isActive ? "PAID" : "FREE" },
          });
          console.log(
            "[billing] subscription updated:",
            sub.id,
            "status:",
            sub.status,
            "tier:",
            isActive ? "PAID" : "FREE"
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const session = await prisma.session.findFirst({
          where: { subscriptionId: sub.id },
        });

        if (!session) {
          console.warn(
            "[billing] subscription.deleted: no session found for sub",
            sub.id
          );
          break;
        }

        await prisma.session.update({
          where: { id: session.id },
          data: { tier: "FREE", subscriptionId: null },
        });

        // Invalidate magic tokens
        if (session.email) {
          await invalidateTokensForEmail(session.email);
        }

        console.log(
          "[billing] subscription cancelled, downgrading session",
          session.id
        );

        // Send cancellation email
        if (session.email) {
          await sendEmail(
            session.email,
            "Your Sit With You subscription",
            `<p>Hi,</p>
            <p>Your subscription has ended. You can still use Sit With You with the free tier.</p>
            <p>If you'd like to come back, you can resubscribe anytime at <a href="https://sitwithyou.app/upgrade">sitwithyou.app/upgrade</a>.</p>
            <p>Take care,<br/>Sit With You</p>`
          ).catch((err) =>
            console.error("[email] cancellation email failed:", err)
          );
        }
        break;
      }

      default:
        console.log("[billing] unhandled event type:", event.type);
    }
  } catch (err) {
    console.error("[billing] webhook handler error:", err);
  }

  // Always return 200 to stop Stripe retrying
  return res.json({ received: true });
}

// ── POST /api/billing/portal ─────────────────────────────────────────────

billingRouter.post("/portal", async (req: Request, res: Response) => {
  try {
    const sessionId =
      req.signedCookies?.sh_session ||
      req.cookies?.sh_session ||
      req.body?.sessionId;

    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!session || session.tier !== "PAID") {
      return res.status(403).json({ error: "No active subscription" });
    }

    if (!session.subscriptionId) {
      return res.status(400).json({ error: "No subscription ID on record" });
    }

    const sub = await stripe.subscriptions.retrieve(session.subscriptionId);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.customer as string,
      return_url: `${FRONTEND_URL}/`,
    });

    console.log("[billing] portal session created for session", sessionId);
    return res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("[billing] portal error:", err);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
});

billingRouter.post("/webhook", billingWebhookHandler);
