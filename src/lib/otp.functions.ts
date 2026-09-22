import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function directTwilioConfigured() {
  return Boolean(process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"] && process.env["TWILIO_VERIFY_SERVICE_SID"]);
}

function directTwilioServiceSid() {
  const sid = process.env["TWILIO_VERIFY_SERVICE_SID"];
  if (!sid) throw new Error("SMS service is not configured.");
  return sid;
}

function directTwilioAuth() {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  if (!accountSid || !authToken) throw new Error("SMS service is not configured.");
  return "Basic " + Buffer.from(accountSid + ":" + authToken).toString("base64");
}

async function sendTwilioVerification(phone: string) {
  if (directTwilioConfigured()) {
    return fetch("https://verify.twilio.com/v2/Services/" + directTwilioServiceSid() + "/Verifications", {
      method: "POST",
      headers: { Authorization: directTwilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: "+91" + phone, Channel: "sms" }),
    });
  }
  return fetch(GATEWAY_URL + "/verify/v2/Services/" + serviceSid() + "/Verifications", {
    method: "POST",
    headers: twilioHeaders(),
    body: new URLSearchParams({ To: "+91" + phone, Channel: "sms" }),
  });
}

async function verifyTwilioCode(phone: string, code: string) {
  if (directTwilioConfigured()) {
    return fetch("https://verify.twilio.com/v2/Services/" + directTwilioServiceSid() + "/VerificationCheck", {
      method: "POST",
      headers: { Authorization: directTwilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: "+91" + phone, Code: code }),
    });
  }
  return fetch(GATEWAY_URL + "/verify/v2/Services/" + serviceSid() + "/VerificationCheck", {
    method: "POST",
    headers: twilioHeaders(),
    body: new URLSearchParams({ To: "+91" + phone, Code: code }),
  });
}

const phoneSchema = (phone: unknown) => {
  if (typeof phone !== "string" || !/^[6-9]\d{9}$/.test(phone)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }
  return phone;
};

function twilioHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  if (!lovableKey || !twilioKey) {
    throw new Error("SMS service is not configured. Please use PIN login for now.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": twilioKey,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function serviceSid() {
  const sid = process.env["TWILIO_VERIFY_SERVICE_SID"];
  if (!sid) throw new Error("SMS service is not configured. Please use PIN login for now.");
  return sid;
}

function friendlyTwilioError(status: number, body: string) {
  let message = "";
  try {
    const parsed = JSON.parse(body) as { message?: string; code?: number };
    message = parsed.message ?? "";
    if (parsed.code === 60200) message = "That mobile number looks invalid.";
    if (parsed.code === 60202) message = "Too many attempts. Request a new code in a few minutes.";
    if (parsed.code === 20429 || status === 429) message = "Too many requests. Please wait a minute and try again.";
  } catch {
    message = body.slice(0, 200);
  }
  return message || `SMS service error (${status}).`;
}

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string }) => ({ phone: phoneSchema(data?.phone) }))
  .handler(async ({ data }) => {
    const res = await sendTwilioVerification(data.phone);
    if (!res.ok) {
      const text = await res.text();
      console.error(`Twilio send failed [${res.status}]: ${text}`);
      throw new Error(friendlyTwilioError(res.status, text));
    }
    return { sent: true as const };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; code: string; username?: string; referral?: string }) => {
    const code = typeof data?.code === "string" ? data.code.trim() : "";
    if (!/^\d{4,10}$/.test(code)) throw new Error("Enter the 6-digit code from the SMS.");
    return {
      phone: phoneSchema(data?.phone),
      code,
      username: typeof data?.username === "string" ? data.username.trim().slice(0, 16) : "",
      referral: typeof data?.referral === "string" ? data.referral.trim().slice(0, 20) : "",
    };
  })
  .handler(async ({ data }) => {
    const res = await verifyTwilioCode(data.phone, data.code);
    const text = await res.text();
    if (!res.ok) {
      console.error(`Twilio check failed [${res.status}]: ${text}`);
      throw new Error(friendlyTwilioError(res.status, text));
    }
    const check = JSON.parse(text) as { status?: string };
    if (check.status !== "approved") {
      throw new Error("That code is incorrect or expired. Request a new one.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `p${data.phone}@funbattle.app`;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();

    let isNew = false;
    if (!existing) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID(),
        user_metadata: {
          phone: data.phone,
          username: data.username || `Player${data.phone.slice(-4)}`,
          referral_code: data.referral || null,
        },
      });
      if (createError && !`${createError.message}`.toLowerCase().includes("already")) {
        console.error("createUser failed", createError);
        throw new Error("Could not create your account. Please try again.");
      }
      isNew = true;
    }

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      console.error("generateLink failed", linkError);
      throw new Error("Could not complete sign in. Please try again.");
    }

    return { email, tokenHash: link.properties.hashed_token, isNew };
  });
