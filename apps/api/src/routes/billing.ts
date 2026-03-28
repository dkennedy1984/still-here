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

billingRouter.post(
  "/create-checkout",
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.cookies?.sh_session || req.body.sessionId;
      if (!sessionId) return res.status(400).json({ error: "No session" });

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) return res.status(404).json({ error: "Session not found" });

      const priceId = process.env.STRIPE_PRICE_ID;
      if (!priceId)
        return res.status(500).json({ error: "Stripe not configured" });

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${FRONTEND_URL}/?upgraded=true`,
        cancel_url: `${FRONTEND_URL}/upgrade?cancelled=true`,
        metadata: { sessionId: session.id },
        ...(session.email ? { customer_email: session.email } : {}),
      });

      console.log("[billing] checkout session created:", checkoutSession.id);
      return res.json({ url: checkoutSession.url });
    } catch (err) {
      console.error("[billing] create-checkout error:", err);
      return res.status(500).json({ error: "Failed to create checkout" });
    }
  }
);

// ── POST /api/billing/webhook — Stripe webhook handler ───────────────────

// Note: this route expects express.raw() middleware — applied in index.ts
export async function billingWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("[billing] missing signature or webhook secret");
    return res.status(400).send("Missing signature");
  }

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
        const checkout = event.data.object as Stripe.Checkout.Session;
        const sessionId = checkout.metadata?.sessionId;
        const email =
          checkout.customer_email || checkout.customer_details?.email;
        const subscriptionId = checkout.subscription as string;
        const customerId = checkout.customer as string;

        if (sessionId) {
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              tier: "PAID",
              subscriptionId,
              stripeCustomerId: customerId || undefined,
              ...(email
                ? { email, emailVerified: true, emailVerifiedAt: new Date() }
                : {}),
            },
          });
          console.log("[billing] session upgraded to PAID:", sessionId);

          // Send welcome email
          if (email) {
            await sendEmail(
              email,
              "Welcome to Sit With You",
              `<p>Hi,</p>
              <p>Thanks for choosing to sit with us. Your subscription is now active.</p>
              <p>You can start a call anytime at <a href="https://sitwithyou.app">sitwithyou.app</a>.</p>
              <p>If you ever need to manage your subscription, just reply to this email.</p>
              <p>Take care,<br/>Sit With You</p>`
            ).catch((err) =>
              console.error("[email] welcome email failed:", err)
            );
          }
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

    return res.json({ received: true });
  } catch (err) {
    console.error("[billing] webhook handler error:", err);
    return res.status(500).json({ error: "Handler error" });
  }
}

billingRouter.post("/webhook", billingWebhookHandler);
