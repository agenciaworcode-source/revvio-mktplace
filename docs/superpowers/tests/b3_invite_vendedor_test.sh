#!/usr/bin/env bash
# Integração: garagista chama invite-vendedor e cria um vendedor na própria loja.
# Pré-requisito: `supabase start` no ar. Sobe `functions serve` sozinho.
set -uo pipefail
API="http://127.0.0.1:54321"
PSQL() { docker exec -i "$(docker ps -qf name=supabase_db)" psql -U postgres -d postgres -tAc "$1"; }
SRV_KEY=$(supabase status -o env 2>/dev/null | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '"')
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

EMAIL_G="garagista-b3@test.dev"; PW="senha123456"
EMAIL_V="vendedor-b3@test.dev"

cleanup() {
  PSQL "delete from public.rv_sellers where email in ('$EMAIL_G','$EMAIL_V');" >/dev/null
  PSQL "delete from auth.users where email in ('$EMAIL_G','$EMAIL_V');" >/dev/null
  [ -n "${SERVE_PID:-}" ] && kill "$SERVE_PID" 2>/dev/null
}
trap cleanup EXIT
cleanup  # limpa restos de execuções anteriores

# 1. cria o garagista (usuário confirmado) + linha rv_sellers
GID=$(curl -s "$API/auth/v1/admin/users" -H "apikey: $SRV_KEY" -H "Authorization: Bearer $SRV_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_G\",\"password\":\"$PW\",\"email_confirm\":true}" | grep -oP '"id":"\K[^"]+' | head -1)
[ -n "$GID" ] || { echo "FALHA: não criou o garagista"; exit 1; }
PSQL "insert into public.rv_sellers (user_id,name,slug,email,status,role,commission_rate)
      values ('$GID','Garagem B3','garagem-b3','$EMAIL_G','active','garagista',0);" >/dev/null

# 2. login do garagista → access_token
TOKEN=$(curl -s "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_G\",\"password\":\"$PW\"}" \
  | grep -oP '"access_token":"\K[^"]+' | head -1)
[ -n "$TOKEN" ] || { echo "FALHA: login do garagista"; exit 1; }

# 3. sobe as functions localmente, se ainda não estiver no ar (serve serve TODAS;
#    a auth é feita na própria função). curls SEMPRE com --max-time p/ não travar no boot.
PROBE_URL="$API/functions/v1/invite-vendedor"
probe() { curl -s --max-time 5 "$PROBE_URL" -X POST -H "Authorization: Bearer $TOKEN" \
            -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}'; }
case "$(probe)" in
  *"Function not found"*|"")
    supabase functions serve --no-verify-jwt >/tmp/b3-serve.log 2>&1 &
    SERVE_PID=$! ;;
esac
READY=""
for i in $(seq 1 60); do
  case "$(probe)" in
    *"Function not found"*|"") sleep 2 ;;
    *) READY=1; break ;;
  esac
done
[ -n "$READY" ] || { echo "FALHA: function não ficou pronta. log:"; tail -15 /tmp/b3-serve.log; exit 1; }

# 4. garagista convida o vendedor (taxa 7%)
RESP=$(curl -s --max-time 20 "$API/functions/v1/invite-vendedor" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Vendedor B3\",\"email\":\"$EMAIL_V\",\"commission_rate\":7}")
echo "resposta: $RESP"

# 5. asserts no banco: vendedor criado, vinculado à loja do garagista, ativo, taxa 7
SID=$(PSQL "select id from public.rv_sellers where user_id='$GID'")
ROW=$(PSQL "select role||'|'||status||'|'||coalesce(commission_rate::text,'null')||'|'||(parent_id = '$SID')
            from public.rv_sellers where email='$EMAIL_V';")
echo "linha vendedor: $ROW"
[ "$ROW" = "vendedor|active|7.00|true" ] || { echo "FALHA: vendedor não criado corretamente ($ROW)"; exit 1; }

echo "✅ B3 invite-vendedor OK"
