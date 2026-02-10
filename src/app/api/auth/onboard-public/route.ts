import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

const parseDomains = (value?: string) =>
  (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export async function POST(request: NextRequest) {
  try {
    const { tenantName, fullName, userId, inviteCode, turnstileToken, email } =
      (await request.json()) as {
        tenantName?: string;
        fullName?: string;
        userId?: string;
        inviteCode?: string;
        turnstileToken?: string;
        email?: string;
      };

    if (!tenantName || !fullName || !userId) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const requiredInvite = process.env.INVITE_CODE || "";
    if (requiredInvite && inviteCode !== requiredInvite) {
      return NextResponse.json({ error: "Code d'invitation invalide" }, { status: 403 });
    }

    const allowedDomains = parseDomains(process.env.ALLOWED_EMAIL_DOMAINS);
    if (allowedDomains.length && email) {
      const domain = email.split("@")[1]?.toLowerCase() || "";
      if (!allowedDomains.includes(domain)) {
        return NextResponse.json({ error: "Domaine email non autorisé" }, { status: 403 });
      }
    }

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || "";
    if (turnstileSecret) {
      if (!turnstileToken) {
        return NextResponse.json({ error: "Captcha requis" }, { status: 403 });
      }
      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken
        })
      });
      const payload = await verify.json();
      if (!payload.success) {
        return NextResponse.json({ error: "Captcha invalide" }, { status: 403 });
      }
    }

    const supabase = createServiceSupabase();
    const existing = await supabase.from("profiles").select("id").eq("id", userId).single();
    if (existing.data) {
      return NextResponse.json({ ok: true });
    }

    const tenantInsert = await supabase
      .from("tenants")
      .insert({ name: tenantName })
      .select("id")
      .single();

    if (tenantInsert.error || !tenantInsert.data) {
      return NextResponse.json(
        { error: tenantInsert.error?.message || "Tenant insert failed" },
        { status: 500 }
      );
    }

    const profileInsert = await supabase.from("profiles").insert({
      id: userId,
      tenant_id: tenantInsert.data.id,
      full_name: fullName,
      role: "owner"
    });

    if (profileInsert.error) {
      return NextResponse.json(
        { error: profileInsert.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, tenantId: tenantInsert.data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
