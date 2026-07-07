import { LegalPage, LegalList, type LegalSection } from "../components/legal/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    id: "introducao",
    heading: "Introdução",
    body: (
      <>
        <p>
          O REVVIO tem o compromisso de proteger a privacidade e os dados pessoais de seus
          usuários, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 —
          LGPD). Esta Política descreve como coletamos, usamos, armazenamos e protegemos as suas
          informações ao utilizar a plataforma <strong>revvio.com.br</strong>.
        </p>
        <p>
          Ao acessar ou utilizar o site, você declara estar ciente e de acordo com as práticas
          descritas nesta Política de Privacidade.
        </p>
      </>
    ),
  },
  {
    id: "dados-coletados",
    heading: "Dados que coletamos",
    body: (
      <>
        <p>Podemos coletar as seguintes categorias de dados:</p>
        <LegalList
          items={[
            "Dados de cadastro: nome, e-mail, telefone e CPF/CNPJ ao criar uma conta.",
            "Dados de anúncios: informações dos veículos publicados pelas lojas e anunciantes.",
            "Dados de navegação: páginas visitadas, buscas realizadas e interações na plataforma.",
            "Cookies e identificadores: usados para autenticação, preferências e métricas de uso.",
          ]}
        />
      </>
    ),
  },
  {
    id: "uso-dos-dados",
    heading: "Como usamos os seus dados",
    body: (
      <>
        <p>Utilizamos os dados coletados para as seguintes finalidades:</p>
        <LegalList
          items={[
            "Criar e gerenciar a sua conta na plataforma.",
            "Publicar e exibir os anúncios de veículos.",
            "Facilitar o contato entre compradores e lojas.",
            "Enviar notificações e comunicações relevantes sobre o serviço.",
            "Melhorar a experiência, a segurança e as funcionalidades da plataforma.",
            "Prevenir fraudes e usos indevidos.",
            "Cumprir obrigações legais e regulatórias.",
          ]}
        />
      </>
    ),
  },
  {
    id: "armazenamento",
    heading: "Armazenamento e retenção",
    body: (
      <p>
        Os seus dados são mantidos em servidores seguros enquanto a sua conta estiver ativa ou
        conforme necessário para as finalidades descritas nesta Política. Após a exclusão da conta,
        os dados são eliminados ou anonimizados em prazo razoável, ressalvadas as hipóteses de
        guarda obrigatória previstas em lei.
      </p>
    ),
  },
  {
    id: "compartilhamento",
    heading: "Compartilhamento de dados",
    body: (
      <>
        <p>
          O REVVIO <strong>não vende</strong> os seus dados pessoais. O compartilhamento ocorre
          apenas quando necessário:
        </p>
        <LegalList
          items={[
            "Com prestadores de serviço que apoiam a operação da plataforma (ex.: hospedagem e pagamentos).",
            "Para cumprimento de obrigação legal ou ordem de autoridade competente.",
            "Para proteção de direitos, segurança e prevenção a fraudes.",
          ]}
        />
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: (
      <>
        <p>Utilizamos diferentes tipos de cookies:</p>
        <LegalList
          items={[
            "Essenciais: necessários para o funcionamento e a autenticação da plataforma.",
            "Analíticos: ajudam a entender como o site é utilizado e a melhorá-lo.",
            "De preferência: lembram as suas escolhas para uma melhor experiência.",
          ]}
        />
        <p>Você pode gerenciar ou desativar cookies nas configurações do seu navegador.</p>
      </>
    ),
  },
  {
    id: "seus-direitos",
    heading: "Seus direitos (LGPD)",
    body: (
      <>
        <p>Como titular dos dados, você tem direito a:</p>
        <LegalList
          items={[
            "Acessar os seus dados pessoais.",
            "Corrigir dados incompletos, inexatos ou desatualizados.",
            "Solicitar a exclusão dos seus dados.",
            "Solicitar a portabilidade dos dados.",
            "Revogar o consentimento a qualquer momento.",
            "Opor-se a determinados tratamentos de dados.",
          ]}
        />
      </>
    ),
  },
  {
    id: "seguranca",
    heading: "Segurança das informações",
    body: (
      <p>
        Adotamos medidas técnicas e organizacionais para proteger os seus dados, incluindo conexão
        criptografada (HTTPS/SSL), controle de acesso e rotinas de backup. Ainda assim, nenhum
        sistema é 100% imune; em caso de incidente relevante, atuaremos conforme a legislação
        aplicável.
      </p>
    ),
  },
  {
    id: "alteracoes",
    heading: "Alterações nesta Política",
    body: (
      <p>
        Esta Política pode ser atualizada periodicamente. Alterações relevantes serão informadas
        por e-mail ou por aviso na plataforma. Recomendamos a revisão regular desta página.
      </p>
    ),
  },
  {
    id: "contato",
    heading: "Contato e Encarregado de Dados (DPO)",
    body: (
      <>
        <p>Para exercer os seus direitos ou esclarecer dúvidas sobre esta Política, fale conosco:</p>
        <LegalList
          items={[
            <>E-mail: <strong>contato@revvio.com.br</strong></>,
            <>Telefone / WhatsApp: <strong>(14) 98180-0854</strong></>,
            <>Endereço: <strong>Av. Ipiranga, 207 — Centro, Marília — SP, 17509-210</strong></>,
            "Atendimento: segunda a sexta, das 9h às 18h.",
          ]}
        />
      </>
    ),
  },
];

export function PoliticaPrivacidade() {
  return (
    <LegalPage
      title="Política de Privacidade"
      updatedAt="22 de junho de 2026"
      intro="Esta Política descreve como o REVVIO coleta, utiliza e protege os seus dados pessoais, em conformidade com a LGPD (Lei nº 13.709/2018)."
      sections={SECTIONS}
      path="/politica-de-privacidade"
    />
  );
}
