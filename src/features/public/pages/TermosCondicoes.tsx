import { LegalPage, LegalList, type LegalSection } from "../components/legal/LegalPage";

const SECTIONS: LegalSection[] = [
  {
    id: "aceitacao",
    heading: "Aceitação dos Termos",
    body: (
      <p>
        Ao acessar e utilizar a plataforma REVVIO, você concorda integralmente com estes Termos e
        Condições de Uso. Caso não concorde com qualquer disposição, você deve interromper
        imediatamente o uso do site.
      </p>
    ),
  },
  {
    id: "plataforma",
    heading: "Sobre a Plataforma",
    body: (
      <p>
        O REVVIO atua como <strong>intermediário tecnológico</strong>, conectando compradores e
        lojas/anunciantes de veículos. A plataforma não é parte das negociações e não participa
        diretamente das transações realizadas entre os usuários.
      </p>
    ),
  },
  {
    id: "cadastro",
    heading: "Cadastro e Conta",
    body: (
      <>
        <p>Ao criar uma conta, você se compromete a:</p>
        <LegalList
          items={[
            "Fornecer informações verídicas, completas e atualizadas.",
            "Manter o sigilo das suas credenciais de acesso.",
            "Ser responsável por todas as atividades realizadas em sua conta.",
          ]}
        />
      </>
    ),
  },
  {
    id: "anuncios",
    heading: "Anúncios de Veículos",
    body: (
      <p>
        Os anunciantes declaram ser legítimos proprietários ou estarem autorizados a vender os
        veículos publicados, garantindo a veracidade das informações e a inexistência de restrições
        judiciais ou impedimentos legais sobre os bens anunciados.
      </p>
    ),
  },
  {
    id: "planos",
    heading: "Lojas e Planos",
    body: (
      <p>
        As lojas anunciantes contratam planos de assinatura, que definem limites de anúncios,
        recursos e destaque na plataforma, conforme as condições específicas de cada plano vigente.
      </p>
    ),
  },
  {
    id: "conduta",
    heading: "Conduta do Usuário",
    body: (
      <>
        <p>É expressamente proibido:</p>
        <LegalList
          items={[
            "Praticar fraudes ou veicular informações falsas.",
            "Enviar spam ou conteúdo não solicitado.",
            "Tentar acessar contas de terceiros sem autorização.",
            "Utilizar robôs, scrapers ou meios automatizados não autorizados.",
            "Realizar qualquer atividade ilícita ou que viole estes Termos.",
          ]}
        />
      </>
    ),
  },
  {
    id: "responsabilidade",
    heading: "Limitação de Responsabilidade",
    body: (
      <p>
        O REVVIO não se responsabiliza pela veracidade dos anúncios, pela qualidade ou condição dos
        veículos, nem pelo cumprimento dos acordos firmados entre compradores e anunciantes. As
        negociações ocorrem por conta e risco das partes envolvidas.
      </p>
    ),
  },
  {
    id: "propriedade-intelectual",
    heading: "Propriedade Intelectual",
    body: (
      <p>
        Todo o conteúdo da plataforma — marca, logotipo, layout, textos e software — pertence ao
        REVVIO e é protegido pela legislação aplicável. É vedada a reprodução total ou parcial sem
        autorização prévia.
      </p>
    ),
  },
  {
    id: "suspensao",
    heading: "Suspensão e Encerramento",
    body: (
      <p>
        Contas que violarem estes Termos, praticarem fraude ou estiverem inadimplentes poderão ser
        suspensas ou encerradas, a critério do REVVIO, sem prejuízo das medidas legais cabíveis.
      </p>
    ),
  },
  {
    id: "foro",
    heading: "Lei Aplicável e Foro",
    body: (
      <p>
        Estes Termos são regidos pela legislação brasileira. Fica eleito o foro do domicílio do
        consumidor para dirimir eventuais controvérsias, salvo disposição legal em contrário.
      </p>
    ),
  },
  {
    id: "contato",
    heading: "Contato",
    body: (
      <>
        <p>Em caso de dúvidas sobre estes Termos, fale conosco:</p>
        <LegalList
          items={[
            <>E-mail: <strong>contato@revvio.com.br</strong></>,
            <>Telefone / WhatsApp: <strong>(14) 98180-0854</strong></>,
            <>Endereço: <strong>Av. Ipiranga, 207 — Centro, Marília — SP, 17509-210</strong></>,
          ]}
        />
      </>
    ),
  },
];

export function TermosCondicoes() {
  return (
    <LegalPage
      title="Termos e Condições de Uso"
      updatedAt="22 de junho de 2026"
      intro="Leia atentamente estes Termos antes de utilizar a plataforma REVVIO. O uso do site implica na aceitação integral destas condições."
      sections={SECTIONS}
      path="/termos-e-condicoes"
    />
  );
}
