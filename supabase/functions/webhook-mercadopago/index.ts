// Edge Function: webhook Mercado Pago -> atualiza subscriptions/payments e desbloqueia
// Deploy: supabase functions deploy webhook-mercadopago --no-verify-jwt
// MP Dashboard -> Webhooks -> https://<projeto>.supabase.co/functions/v1/webhook-mercadopago
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // MP pode mandar GET para validar URL
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    // MP envia { action: "payment.updated", data: { id: "123" }, type: "payment" } ou { id: 123, topic: "payment" }
    const paymentId = body.data?.id || body.id || new URL(req.url).searchParams.get("id") || new URL(req.url).searchParams.get("data.id");
    const topic = body.type || body.topic || new URL(req.url).searchParams.get("topic");
    if (!paymentId) {
      // pode ser merchant_order ou teste - responde ok para MP não retentar
      return new Response(JSON.stringify({ received: true, ignored: true, body }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env faltando");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Se for mock (generate-pix sem MP), paymentId começa com mock_
    let mpStatus = "approved";
    let mpAmount = 29;
    let externalRef: string | null = null;
    let mpPaymentIdStr = String(paymentId);

    if (String(paymentId).startsWith("mock_")) {
      // Mock: busca payment pelo mp_payment_id para desbloquear direto
      const { data: pay } = await supabase.from("payments").select("store_id, amount, competence").eq("mp_payment_id", mpPaymentIdStr).maybeSingle();
      if (pay) {
        externalRef = pay.store_id;
        mpAmount = Number(pay.amount);
      }
    } else if (mpToken) {
      // Real: busca no MP
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      const mp = await mpRes.json();
      if (!mpRes.ok) {
        // MP pode estar propagando, retorna 200 para não retentar com erro
        return new Response(JSON.stringify({ received: true, mp_error: mp }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      mpStatus = mp.status; // approved, pending, rejected
      mpAmount = Number(mp.transaction_amount);
      externalRef = mp.external_reference || mp.metadata?.store_id || null;
      mpPaymentIdStr = String(mp.id);
      // Se MP retornar approved mas external_reference vazio, tenta achar pelo mp_payment_id no banco
      if (!externalRef) {
        const { data: pay } = await supabase.from("payments").select("store_id").eq("mp_payment_id", mpPaymentIdStr).maybeSingle();
        if (pay) externalRef = pay.store_id;
      }
    } else {
      // Sem token e não é mock -> não consegue validar, mas tenta achar no banco
      const { data: pay } = await supabase.from("payments").select("store_id, amount").eq("mp_payment_id", mpPaymentIdStr).maybeSingle();
      if (pay) { externalRef = pay.store_id; mpAmount = Number(pay.amount); }
    }

    if (!externalRef) {
      return new Response(JSON.stringify({ received: true, ignored: true, reason: "store_id not found", paymentId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Atualiza payment
    const isApproved = mpStatus === "approved";
    const updatePay: any = {
      mp_status: mpStatus,
      status: isApproved ? "approved" : mpStatus === "rejected" ? "overdue" : "pending",
      updated_at: new Date().toISOString(),
    };
    if (isApproved) updatePay.paid_at = new Date().toISOString();

    await supabase.from("payments").update(updatePay).eq("mp_payment_id", mpPaymentIdStr);

    // Fallback: se não achou por mp_payment_id, atualiza pela store + competence mais recente pendente
    if (isApproved) {
      const { data: pendingPay } = await supabase.from("payments").select("id, competence, due_date").eq("store_id", externalRef).eq("status", "pending").order("due_date", { ascending: false }).limit(1).maybeSingle();
      if (pendingPay) {
        await supabase.from("payments").update(updatePay).eq("id", pendingPay.id);
      }
    }

    // Desbloqueio: se approved, libera assinatura
    if (isApproved) {
      const months = mpAmount >= 174 ? 6 : 1;
      // Busca assinatura atual para calcular próximo vencimento
      const { data: sub } = await supabase.from("subscriptions").select("current_period_end, prepaid_until").eq("store_id", externalRef).maybeSingle();
      let nextEnd: string;
      if (sub?.current_period_end) {
        const d = new Date(sub.current_period_end + "T12:00:00");
        // se já está no futuro (antecipado), soma a partir dele, senão a partir do due do payment
        if (d > new Date()) {
          d.setMonth(d.getMonth() + (months - 1)); // já conta 1 mês do due, adiciona restante se prepaid
          nextEnd = d.toISOString().slice(0, 10);
        } else {
          // pega due do payment aprovado
          const { data: pay2 } = await supabase.from("payments").select("due_date").eq("store_id", externalRef).eq("status", "approved").order("due_date", { ascending: false }).limit(1).maybeSingle();
          const base = pay2?.due_date ? new Date(pay2.due_date + "T12:00:00") : new Date();
          base.setMonth(base.getMonth() + months);
          nextEnd = base.toISOString().slice(0, 10);
        }
      } else {
        const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + months);
        nextEnd = base.toISOString().slice(0, 10);
      }
      const prepaidUntil = months === 6 ? nextEnd : null;
      await supabase.from("subscriptions").update({
        status: "active",
        current_period_end: nextEnd,
        prepaid_until: prepaidUntil,
        updated_at: new Date().toISOString(),
      }).eq("store_id", externalRef);
    }

    // Se rejeitado/expirado e passou da graça, pode marcar past_due (cron de bloqueio também faz)
    if (mpStatus === "rejected" || mpStatus === "cancelled") {
      await supabase.from("payments").update({ status: "overdue" }).eq("mp_payment_id", mpPaymentIdStr);
    }

    return new Response(JSON.stringify({ received: true, store_id: externalRef, mpStatus, mpAmount, unlocked: isApproved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
