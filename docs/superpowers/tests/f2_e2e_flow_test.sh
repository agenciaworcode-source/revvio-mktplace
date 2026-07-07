#!/usr/bin/env bash
# E2E: garagista convida vendedor (Edge Function) -> registra venda atribuída a
# ele -> comissão gerada na taxa do vendedor -> garagista dá baixa.
# Verifica a CAMADA DE DADOS (não dispara Resend). Pré-req: `supabase start` no ar.
set -uo pipefail
API="http://127.0.0.1:54321"
PSQL() { docker exec -i "$(docker ps -qf name=supabase_db)" psql -U postgres -d postgres -tAc "$1"; }
SRV_KEY=$(supabase status -o env 2>/dev/null | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '"')
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

EMAIL_G="garagista-f2@test.dev"; PW="senha123456"
EMAIL_V="vendedor-f2@test.dev"
VEHICLE_ID=940101

cleanup() {
  PSQL "delete from public.rv_commissions where seller_id in (select id from public.rv_sellers where email='$EMAIL_G');" >/dev/null
  PSQL "delete from public.rv_sales where seller_id in (select id from public.rv_sellers where email='$EMAIL_G');" >/dev/null
  PSQL "delete from public.rv_vehicles where id=$VEHICLE_ID;" >/dev/null
  PSQL "delete from public.rv_sellers where email in ('$EMAIL_G','$EMAIL_V');" >/dev/null
  PSQL "delete from auth.users where email in ('$EMAIL_G','$EMAIL_V');" >/dev/null
  [ -n "${SERVE_PID:-}" ] && kill "$SERVE_PID" 2>/dev/null
}
trap cleanup EXIT
cleanup  # limpa restos de execuções anteriores

# 1. garagista (confirmado) + linha rv_sellers + 1 veículo na loja
GID=$(curl -s "$API/auth/v1/admin/users" -H "apikey: $SRV_KEY" -H "Authorization: Bearer $SRV_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_G\",\"password\":\"$PW\",\"email_confirm\":true}" | grep -oP '"id":"\K[^"]+' | head -1)
[ -n "$GID" ] || { echo "FALHA: não criou o garagista"; exit 1; }
PSQL "insert into public.rv_sellers (user_id,name,slug,email,status,role,commission_rate)
      values ('$GID','Garagem F2','garagem-f2','$EMAIL_G','active','garagista',0);" >/dev/null
SID=$(PSQL "select id from public.rv_sellers where user_id='$GID'")
PSQL "insert into public.rv_vehicles (id,seller_id,make,model,price,status) overriding system value
      values ($VEHICLE_ID,'$SID','VW','Virtus',80000,'available');" >/dev/null

# 2. login do garagista -> access_token
TOKEN=$(curl -s "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_G\",\"password\":\"$PW\"}" \
  | grep -oP '"access_token":"\K[^"]+' | head -1)
[ -n "$TOKEN" ] || { echo "FALHA: login do garagista"; exit 1; }

# 3. sobe as functions se não estiverem no ar (padrão do b3)
PROBE_URL="$API/functions/v1/invite-vendedor"
probe() { curl -s --max-time 5 "$PROBE_URL" -X POST -H "Authorization: Bearer $TOKEN" \
            -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}'; }
case "$(probe)" in
  *"Function not found"*|"")
    supabase functions serve --no-verify-jwt >/tmp/f2-serve.log 2>&1 &
    SERVE_PID=$! ;;
esac
READY=""
for i in $(seq 1 60); do
  case "$(probe)" in
    *"Function not found"*|"") sleep 2 ;;
    *) READY=1; break ;;
  esac
done
[ -n "$READY" ] || { echo "FALHA: function não ficou pronta. log:"; tail -15 /tmp/f2-serve.log; exit 1; }

# 4. CONVITE: garagista cria o vendedor com taxa 8% (camada de dados; Resend não é disparado aqui)
RESP=$(curl -s --max-time 20 "$API/functions/v1/invite-vendedor" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Vendedor F2\",\"email\":\"$EMAIL_V\",\"commission_rate\":8}")
echo "convite: $RESP"
VID=$(echo "$RESP" | grep -oP '"vendedorId":"\K[^"]+' | head -1)
[ -n "$VID" ] || { echo "FALHA: convite não retornou vendedorId"; exit 1; }
# verifica usuário no Auth + linha do vendedor (vinculado à loja, ativo, taxa 8)
AUTHCNT=$(PSQL "select count(*) from auth.users where email='$EMAIL_V';")
[ "$AUTHCNT" = "1" ] || { echo "FALHA: vendedor não criado no Auth (Supabase)"; exit 1; }
ROW=$(PSQL "select role||'|'||status||'|'||commission_rate::text||'|'||(parent_id='$SID')
            from public.rv_sellers where id='$VID';")
[ "$ROW" = "vendedor|active|8.00|true" ] || { echo "FALHA: linha do vendedor incorreta ($ROW)"; exit 1; }

# 5. VENDA: garagista registra a venda atribuída ao vendedor (RPC register_sale)
SALE=$(curl -s --max-time 20 "$API/rest/v1/rpc/register_sale" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"p_vehicle_id\":$VEHICLE_ID,\"p_vendedor_id\":\"$VID\",\"p_buyer_name\":\"Comprador F2\",\"p_sale_price\":80000,\"p_payment_method\":\"pix\"}")
SALE_ID=$(echo "$SALE" | tr -d '"')
echo "venda: $SALE_ID"
[ -n "$SALE_ID" ] && [ "$SALE_ID" != "null" ] || { echo "FALHA: register_sale não retornou id ($SALE)"; exit 1; }
# veículo virou sold
VST=$(PSQL "select status from public.rv_vehicles where id=$VEHICLE_ID;")
[ "$VST" = "sold" ] || { echo "FALHA: veículo não virou sold ($VST)"; exit 1; }

# 6. COMISSÃO: gerada na taxa do vendedor (8% de 80000 = 6400), pending, do vendedor
CID=$(PSQL "select id from public.rv_commissions where sale_id='$SALE_ID';")
CROW=$(PSQL "select amount::text||'|'||rate::text||'|'||status||'|'||(vendedor_id='$VID')
             from public.rv_commissions where id='$CID';")
echo "comissão: $CROW"
[ "$CROW" = "6400.00|8.00|pending|true" ] || { echo "FALHA: comissão incorreta ($CROW)"; exit 1; }

# 7. BAIXA: garagista dá baixa (RPC mark_commission_paid) -> paid
curl -s --max-time 20 "$API/rest/v1/rpc/mark_commission_paid" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"p_commission_id\":\"$CID\"}" >/dev/null
CST=$(PSQL "select status from public.rv_commissions where id='$CID';")
[ "$CST" = "paid" ] || { echo "FALHA: comissão não foi quitada pelo garagista ($CST)"; exit 1; }

echo "✅ F2 fluxo e2e OK"
