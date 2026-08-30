// Edge Function: webhook Mercado Pago -> atualiza subscriptions/payments
// Deploy: supabase functions deploy webhook-mercadopago --no-verify-jwt
// Config MP Dashboard: https://seu-projeto.supabase.co/functions/v1/webhook-mercadopago
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const body = await req.json().catch(()=> ({}));
  const mpId = body.data?.id || body.id;
  const type = body.type || body.action; // payment / merchant_order

  // Valide x-signature com MP_ACCESS_TOKEN se necessário
  // const signature = req.headers.get("x-signature");

  // Busca status real no MP (evita spoof)
  // const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}`, { headers:{ Authorization:`Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` }});
  // const mp = await mpRes.json();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Exemplo: payment approved -> libera
  // if (mp.status === "approved") {
  //   const storeId = mp.external_reference; // envie store_id no external_reference ao criar PIX
  //   await supabase.from("payments").update({ status:"approved", paid_at:new Date().toISOString(), mp_status: mp.status }).eq("mp_payment_id", String(mpId));
  //   const amt = Number(mp.transaction_amount);
  //   const months = amt >= 174 ? 6 : 1;
  //   const { data: sub } = await supabase.from("subscriptions").select("current_period_end").eq("store_id", storeId).single();
  //   let next = new Date(sub.current_period_end); next.setMonth(next.getMonth()+ months);
  //   await supabase.from("subscriptions").update({ status:"active", current_period_end: next.toISOString().slice(0,10), prepaid_until: months===6? next.toISOString().slice(0,10): null }).eq("store_id", storeId);
  // }

  return new Response(JSON.stringify({ received: true, mpId, type }), { headers:{ "Content-Type":"application/json" }});
});
