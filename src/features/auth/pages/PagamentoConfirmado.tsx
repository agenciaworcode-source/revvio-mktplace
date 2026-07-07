import { Link } from "react-router-dom";
import { AuthSplitLayout } from "../AuthSplitLayout";
import { Icon } from "@/features/public/components/icons";

/**
 * Retorno do checkout do ASAAS (callback.successUrl). A conta é criada pelo
 * webhook ao confirmar o pagamento; aqui orientamos o garagista a definir a
 * senha pelo link enviado por e-mail.
 */
export function PagamentoConfirmado() {
  return (
    <AuthSplitLayout
      title="Pagamento recebido 🎉"
      subtitle="Sua mini-loja foi criada com sucesso."
      footer={
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Ir para o login
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <Icon name="mail" size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-800">
            Enviamos um e-mail para você <strong>definir sua senha e acessar</strong> a
            plataforma. Confira sua caixa de entrada (e a pasta de spam).
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Não recebeu em alguns minutos? Você também pode definir a senha em{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Entrar
          </Link>{" "}
          usando <strong>“Esqueci minha senha”</strong> com o e-mail do cadastro.
        </p>
      </div>
    </AuthSplitLayout>
  );
}
