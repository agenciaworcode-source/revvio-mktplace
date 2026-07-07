import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthProvider";
import { AuthLayout } from "../AuthLayout";
import { Alert, Button } from "@/components/ui";

function SignOutButton() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <Button
      variant="outline"
      fullWidth
      onClick={async () => {
        await signOut();
        navigate("/login", { replace: true });
      }}
    >
      Sair
    </Button>
  );
}

/** Vendedor com status=pending: aguardando o admin aprovar. */
export function AguardandoAprovacao() {
  const { seller } = useAuth();
  return (
    <AuthLayout title="Cadastro em análise">
      <div className="flex flex-col gap-4">
        <Alert variant="warning">
          {seller?.name ? `Olá, ${seller.name}! ` : ""}
          Seu cadastro foi recebido e está aguardando a aprovação do administrador.
          Assim que for liberado, você poderá acessar seu painel e publicar veículos.
        </Alert>
        <SignOutButton />
      </div>
    </AuthLayout>
  );
}

/** Vendedor com status=suspended: acesso bloqueado pelo admin. */
export function ContaSuspensa() {
  return (
    <AuthLayout title="Conta suspensa">
      <div className="flex flex-col gap-4">
        <Alert variant="error">
          Seu acesso à plataforma foi suspenso pelo administrador. Entre em contato com a
          gestão para regularizar sua situação.
        </Alert>
        <SignOutButton />
      </div>
    </AuthLayout>
  );
}
