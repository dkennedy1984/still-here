import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

export const billingRouter: Router = Router();

const MAGIC_LINK_BASE_URL = process.env.MAGIC_LINK_BASE_URL || process.env.API_BASE_URL || "http://localhost:4000";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Still Here <hello@sitwithyou.app>";

function verifyStripeSignature(payload: Buffer, sigHeader: string, secret: string): any {
  const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.trim().split("=");
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const signature = parts["v1"];

  if (!timestamp || !signature) throw new Error("Missing signature parts");

  const signedPayload = `${timestamp}.${payload.toString("utf8")}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  if (expectedSig !== signature) throw new Error("Signature mismatch");

  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > 300) throw new Error("Webhook timestamp too old");

  return JSON.parse(payload.toString("utf8"));
}

async function invalidateTokensForEmail(email: string) {
  await prisma.magicToken.updateMany({
    where: { email, used: false },
    data: { used: true, expiresAt: new Date() },
  });
}

async function sendMagicLinkEmail(email: string) {
  try {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const magicToken = await prisma.magicToken.create({
      data: { email, expiresAt },
    });

    const magicLinkUrl = `${MAGIC_LINK_BASE_URL}/api/v1/auth/verify?token=${magicToken.token}`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: email,
        subject: "Welcome to Still Here — access your account",
        html:
          "<p>Hi,</p>" +
          "<p>Your subscription is active. Click the link below to access Still Here on this device:</p>" +
          '<p><a href="' + magicLinkUrl + '">Open Still Here</a></p>' +
          "<p>This link expires in 15 minutes. You can always request a new one from the app.</p>",
      }),
    });

    console.log("[billing] magic link sent to", email);
  } catch (err) {
    console.error("[billing] failed to send magic link:", err);
  }
}

// POST /api/billing/webhook
// Note: this route expects express.raw() middleware — applied in index.ts
export async function billingWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  let event: any;

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  if (!STRIPE_WEBHOOK_SECRET || STRIPE_WEBHOOK_SECRET.startsWith("whsec_placeholder")) {
    console.warn("[billing] STRIPE_WEBHOOK_SECRET is a placeholder — skipping signature verification");
    try {
      event = JSON.parse((req.body as Buffer).toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  } else {
    try {
      event = verifyStripeSignature(req.body as Buffer, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("[billing] Stripe signature verification failed:", err.message);
      return res.status(400).json({ error: "Invalid signature" });
    }
  }

  console.log("[billing] received event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object;
        const customerEmail =
          checkoutSession.customer_details?.email ||
          checkoutSession.customer_email;
        const stripeCustomerId = checkoutSession.customer as string | null;
        const stripeSubId = checkoutSession.subscription as string | null;

        if (!customerEmail) {
          console.warn("[billing] checkout.session.completed: no email found");
          break;
        }

        const normalizedEmail = customerEmail.trim().toLowerCase();

        let session = await prisma.session.findFirst({
          where: { email: normalizedEmail },
          orderBy: { createdAt: "desc" },
        });

        if (!session) {
          session = await prisma.session.create({
            data: {
              email: normalizedEmail,
              emailVerified: true,
              emailVerifiedAt: new Date(),
              tier: "paid",
              subscriptionId: stripeSubId ?? undefined,
              stripeCustomerId: stripeCustomerId ?? undefined,
            },
          });
        } else {
          session = await prisma.session.update({
            where: { id: session.id },
            data: {
              tier: "paid",
              subscriptionId: stripeSubId ?? session.subscriptionId,
              stripeCustomerId: stripeCustomerId ?? session.stripeCustomerId,
            },
          });
        }

        console.log("[billing] checkout completed, session", session.id, "upgraded to paid");
        await sendMagicLinkEmail(normalizedEmail);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const status = sub.status as string;
        const stripeSubId = sub.id as string;

        const session = await prisma.session.findFirst({
          where: { subscriptionId: stripeSubId },
        });

        if (!session) {
          console.warn("[billing] subscription.updated: no session found for sub", stripeSubId);
          break;
        }

        if (status === "active" || status === "trialing") {
          await prisma.session.update({
            where: { id: session.id },
            data: { tier: "paid" },
          });
          console.log("[billing] subscription active, session", session.id, "tier=paid");
        } else if (status === "canceled" || status === "past_due" || status === "unpaid") {
          await prisma.session.update({
            where: { id: session.id },
            data: { tier: "free" },
          });
          if (session.email) await invalidateTokensForEmail(session.email);
          console.log("[billing] subscription", status, ", downgrading session", session.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const stripeSubId = sub.id as string;

        const session = await prisma.session.findFirst({
          where: { subscriptionId: stripeSubId },
        });

        if (!session) {
          console.warn("[billing] subscription.deleted: no session found for sub", stripeSubId);
          break;
        }

        await prisma.session.update({
          where: { id: session.id },
          data: { tier: "free" },
        });

        if (session.email) await invalidateTokensForEmail(session.email);
        console.log("[billing] subscription cancelled, downgrading session", session.id);
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
