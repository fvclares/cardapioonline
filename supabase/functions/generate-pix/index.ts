// Edge Function: generate-pix - cria PIX Mercado Pago e grava subscriptions/payments
// POST { store_id, amount: 29 | 174, payer_email? }
// Requer secrets: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function nextDueDateISO(): string {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { store_id, amount, payer_email } = await req.json();
    if (!store_id) throw new Error("store_id obrigatório");
    const amt = Number(amount);
    if (![29, 174, 29.00, 174.00].includes(amt) && amt !== 29 && amt !== 174) {
      // permite 29 ou 174, mas se outro valor vier, aceita e arredonda
      if (isNaN(amt) || amt <= 0) throw new Error("amount inválido (29 ou 174)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env faltando");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Busca loja para description e email da própria loja (owner)
    const { data: store } = await supabase.from("stores").select("name, slug, owner_id").eq("id", store_id).maybeSingle();
    let ownerEmail: string | null = payer_email || null;
    if (!ownerEmail && store?.owner_id) {
      const { data: prof } = await supabase.from("profiles").select("email").eq("id", store.owner_id).maybeSingle();
      if (prof?.email) ownerEmail = prof.email;
    }
    // fallback busca user dono via auth se profiles não tiver
    if (!ownerEmail) {
      const { data: ownerStore } = await supabase.from("stores").select("owner_id").eq("id", store_id).single().catch(()=>({data:null}));
      ownerEmail = ownerEmail || (ownerStore as any)?.owner_id || null;
    }
    const dueDate = nextDueDateISO();
    const competence = dueDate.slice(0, 7);
    const graceUntil = new Date(dueDate + "T23:59:59").toISOString();
    // expiração PIX: dia 06 23:59 do mês de competência
    const expDate = new Date(dueDate + "T23:59:59");
    // Mercado Pago espera expiration em ISO (max 30 dias)
    const expirationISO = expDate.toISOString();

    // Se MP token não configurado, faz modo MOCK (para dev/teste sem MP)
    let pixCopy = "";
    let pixQr = "";
    let mpPaymentId: string | null = null;

    if (!mpToken) {
      // MOCK - gera copia e cola fake mas grava no banco para desbloquear manual via webhook mock
      pixCopy = `00020126580014BR.GOV.BCB.PIX0136${store_id.slice(0,16)}52040000530398654${String(amt).replace(".", "")}5802BR5925${(store?.name || "Pizzaria").slice(0,25)}6009SAO PAULO62070503***6304ABCD`;
      mpPaymentId = "mock_" + Date.now();
    } else {
      // Cria pagamento PIX real no MP
      const payerEmail = (ownerEmail && ownerEmail.includes("@") ? ownerEmail : payer_email) || ownerEmail || "pagador@exemplo.com";
      const mpBody = {
        transaction_amount: amt,
        description: store ? `${store.name} - Assinatura ${competence} R$${amt}` : `Assinatura ${competence} R$${amt}`,
        payment_method_id: "pix",
        external_reference: store_id,
        notification_url: `${supabaseUrl}/functions/v1/webhook-mercadopago`,
        payer: { email: payerEmail, first_name: (store?.name || "Lojista").slice(0, 30) },
        date_of_expiration: expirationISO,
      };
      const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${mpToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(mpBody),
      });
      const mpData = await mpRes.json();
      if (!mpRes.ok) {
        throw new Error(`MP erro ${mpRes.status}: ${JSON.stringify(mpData)}`);
      }
      // PIX copia e cola e QR estão em point_of_interaction
      pixCopy = mpData.point_of_interaction?.transaction_data?.qr_code || mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";
      // Se vier base64, transforma em data url
      const b64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
      if (b64) pixQr = `data:image/png;base64,${b64}`;
      else pixQr = "";
      // Se qr_code for copia e cola, usa ele
      if (!pixCopy && mpData.point_of_interaction?.transaction_data?.qr_code) pixCopy = mpData.point_of_interaction.transaction_data.qr_code;
      if (!pixCopy) pixCopy = mpData.point_of_interaction?.transaction_data?.qr_code || "";
      mpPaymentId = String(mpData.id);
      // Se não veio qr_code, usa ticket_url
      if (!pixCopy) pixCopy = mpData.point_of_interaction?.transaction_data?.ticket_url || "";
    }

    // Upsert subscription (grace até pagar, prepaid se 174)
    const isPrepaid = amt >= 174;
    let prepaidUntil: string | null = null;
    let currentEnd = dueDate;
    if (isPrepaid) {
      const d = new Date(dueDate); d.setMonth(d.getMonth() + 5);
      prepaidUntil = d.toISOString().slice(0, 10);
      currentEnd = prepaidUntil;
    }

    await supabase.from("subscriptions").upsert({
      store_id,
      plan_amount: 29.00,
      status: "grace",
      current_period_end: currentEnd,
      prepaid_until: prepaidUntil,
      pix_copy_paste: pixCopy,
      pix_qr: pixQr,
      mp_payment_id: mpPaymentId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id" });

    await supabase.from("payments").upsert({
      store_id,
      competence,
      due_date: dueDate,
      grace_until: graceUntil,
      amount: amt,
      status: "pending",
      mp_payment_id: mpPaymentId,
      pix_copy_paste: pixCopy,
      pix_qr: pixQr,
    }, { onConflict: "store_id,competence" });

    return new Response(JSON.stringify({ ok: true, pix_copy_paste: pixCopy, pix_qr: pixQr, mp_payment_id: mpPaymentId, due_date: dueDate, competence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
