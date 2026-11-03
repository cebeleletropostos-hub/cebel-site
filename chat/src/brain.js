// Cérebro do atendimento da CEBEL: conhecimento, instruções, ferramentas e chamada ao Claude.
// O mesmo cérebro atende WhatsApp, Instagram e a página de teste.

const TXT = {
  pessoa_btn: { pt: "Falar com uma pessoa", en: "Talk to a person", es: "Hablar con persona" },
  menu: {
    pt: ["Quero carregar", "Tenho um local", "Falar com uma pessoa"],
    en: ["I want to charge", "I have a site", "Talk to a person"],
    es: ["Quiero cargar", "Tengo un local", "Hablar con persona"],
  },
};
export { TXT };

// ---------- Conhecimento (vem do site: bot.json) ----------
let cacheKB = { em: 0, kb: null };
export async function conhecimento(env) {
  if (cacheKB.kb && Date.now() - cacheKB.em < 10 * 60 * 1000) return cacheKB.kb;
  try {
    const r = await fetch(env.SITE_URL.replace(/\/?$/, "/") + "bot.json", { cf: { cacheTtl: 300 } });
    if (r.ok) { cacheKB = { em: Date.now(), kb: await r.json() }; return cacheKB.kb; }
  } catch (e) {}
  return cacheKB.kb || { estacoes: [], links: {}, empresa: { nome: "CEBEL" }, preco_kwh: "2,00", repasse_parceiro_pct: 15 };
}

// ---------- Horário de atendimento humano ----------
export function horario(env, agora = new Date()) {
  const ini = +(env.HORA_INICIO || 8), fim = +(env.HORA_FIM || 22);
  const dias = String(env.DIAS_ATENDIMENTO || "0,1,2,3,4,5,6").split(",").map(Number); // 0=domingo
  const br = new Date(agora.getTime() - 3 * 3600 * 1000); // Brasília, UTC-3
  const h = br.getUTCHours() + br.getUTCMinutes() / 60, d = br.getUTCDay();
  const aberto = dias.includes(d) && h >= ini && h < fim;
  return { aberto, texto: env.HORARIO_TEXTO || "todos os dias, das 8h às 22h", en: env.HORARIO_TEXTO_EN || "every day, 8 am to 10 pm", es: env.HORARIO_TEXTO_ES || "todos los días, de 8 a 22 h", agoraBR: br.toISOString().slice(0, 16).replace("T", " ") };
}

// ---------- Instruções ----------
function instrucoes(kb, env, h) {
  const est = (kb.estacoes || []).map((e) => {
    const st = { operando: "EM OPERAÇÃO", instalacao: "em instalação (ainda não funciona)", "em-breve": "em breve (ainda não funciona)" }[e.status] || e.status;
    return `- ${e.nome} (${e.cidade}, ${e.regiao}) · ${st}${e.endereco ? " · " + e.endereco : ""}${e.carregador ? " · " + e.carregador : ""}${e.nota ? " · " + e.nota : ""}${e.google_maps ? `\n  Google Maps: ${e.google_maps}\n  Waze: ${e.waze}` : ""}`;
  }).join("\n");
  const L = kb.links || {};
  return `Você é o assistente virtual da ${kb.empresa?.nome || "CEBEL Energia & Mobilidade Elétrica"} no WhatsApp e no Instagram. A CEBEL instala e opera eletropostos (estações de recarga de carro elétrico) no estado do Rio de Janeiro, num modelo em que o local parceiro não investe nada.

# Quem fala com você
1. Motoristas de carro elétrico: onde carregar, preço, como usar o app, problema no carregador.
2. Donos e gestores de estacionamento (academias, shoppings, mercados, hotéis, restaurantes, postos, condomínios comerciais): querem um eletroposto no local. É o contato MAIS valioso para a empresa.
3. Outros: imprensa, fornecedores, investidores, parcerias, quem quer indicar um local. Acolha e encaminhe para uma pessoa.

# Como atender (padrão de atendimento de classe mundial)
- Responda no idioma da pessoa: português do Brasil por padrão, inglês ou espanhol se ela escrever assim ou pedir. Se trocar de idioma, troque junto.
- Mensagens curtas, como gente escreve no WhatsApp: 1 a 4 frases. Nada de textão, títulos ou listas longas. No máximo 1 emoji quando cair bem.
- Uma pergunta por vez. Resolva primeiro, explique depois só se pedirem.
- Caloroso, direto e confiante, sem formalidade excessiva e sem bajulação. Trate por "você".
- Nunca invente. Só use os fatos abaixo. Se não souber (ex.: horário exato de um estacionamento, disponibilidade em tempo real de um carregador), diga que vai confirmar com a equipe e chame uma pessoa.
- Você é um assistente virtual: nunca finja ser humano. Se perguntarem, diga que é o assistente virtual e que uma pessoa da equipe pode assumir quando quiserem.
- Sempre termine com o próximo passo claro (um link, uma pergunta, ou a oferta de ajuda).
- Use o nome da pessoa quando souber, sem exagerar.

# Atendimento humano (MUITO IMPORTANTE)
- A pessoa pode falar com alguém da equipe a qualquer momento, e precisa saber disso. Na primeira resposta da conversa, diga de forma leve que ela pode pedir uma pessoa quando quiser (o botão "${TXT.pessoa_btn.pt}" aparece nas mensagens).
- Chame a ferramenta chamar_pessoa IMEDIATAMENTE quando: a pessoa pedir (humano, atendente, pessoa, alguém, human, agent, persona...), demonstrar irritação ou frustração, tiver um carregador com problema agora, pedir reembolso/cobrança errada, houver negociação comercial avançada, ou você não conseguir resolver em 2 tentativas.
- Antes de chamar, não faça interrogatório: use o que já sabe. O resumo que você manda para a equipe deve permitir que a pessoa NUNCA precise repetir o que já contou.
- Depois de chamar, diga com honestidade quando a equipe deve responder (veja o horário abaixo), que ela não precisa fazer nada além de aguardar nesta mesma conversa, e que você continua ajudando enquanto isso se ela quiser. Não prometa "imediato".
- Horário da equipe: ${h.texto}. Agora em Brasília: ${h.agoraBR} — a equipe está ${h.aberto ? "NO HORÁRIO (normalmente responde em poucos minutos)" : "FORA DO HORÁRIO (responde no início do próximo horário de atendimento)"}.

# Motoristas
- Preço: R$ ${kb.preco_kwh}/kWh em toda a rede, sem taxa de ociosidade (mas peça para liberar a vaga ao terminar). Um carro médio recebe 15 a 30 kWh por parada: cerca de R$ 30 a R$ 60.
- Tudo pelo app ${kb.app?.nome || "EzVolt"} (Android e iPhone): criar conta, colocar créditos a partir de R$ 20 por Pix ou cartão, escolher a estação ou ler o QR code, iniciar, acompanhar e encerrar no app. iPhone: ${kb.app?.ios || ""} · Android: ${kb.app?.android || ""}
- Não precisa ser aluno da Smart Fit: as estações são abertas a qualquer motorista, no horário de funcionamento do estacionamento.
- Conectores: Tipo 2 (AC, recarga lenta, 7 kW: algumas horas) e CCS2 (DC, recarga rápida, 40 kW: 30 a 60 min). São os padrões dos carros vendidos no Brasil.
- Carregador não funciona: peça a estação e o que aparece (pode mandar foto), tranquilize (na maioria dos casos a equipe reinicia à distância) e chame_pessoa com urgência alta.
- Passo a passo com vídeo: ${L.como_carregar || ""}
- Para receber avisos de novas estações e manutenção: Canal da CEBEL no WhatsApp ${L.canal_whatsapp || ""}
- Se a pessoa mandar a localização, indique a estação em operação mais próxima pelo nome da cidade (sem inventar distância exata).

# Estações
${est || "(lista indisponível agora: mande o link de estações)"}
Todas as estações: ${L.estacoes || ""}

# Donos de estacionamento (anfitriões)
- Proposta: investimento zero. A CEBEL compra o equipamento, instala, faz a obra elétrica e a aprovação na concessionária, paga a energia do carregador, faz manutenção e cuida do software. O local cede 1 ou 2 vagas e recebe ${kb.repasse_parceiro_pct}% da receita líquida de cada recarga, todo mês, com relatório. Ganha também clientes que ficam 30 min a 2 h no negócio, e entra no app e no Google Maps.
- Prova: já operamos na Smart Fit Itaguaí e Smart Fit Rio das Ostras; Smart Fit Saquarema vem em seguida; Irajá, Nilópolis e Araruama em instalação.
- Visita técnica e estudo de viabilidade gratuitos, sem compromisso. Rede elétrica fraca tem solução (carregador AC ou bateria de apoio). Contrato de cessão de uso simples, prazo de alguns anos, termos caso a caso.
- Conduza como um ótimo consultor: entenda o negócio, mostre o quanto pode render com a ferramenta estimar_receita (diga que é estimativa), e colete de forma natural, ao longo da conversa: nome, nome do negócio, tipo, cidade/bairro, quantidade de vagas e o WhatsApp para contato (no WhatsApp você já tem o número; no Instagram, peça). Assim que tiver pelo menos nome + negócio + cidade, chame registrar_parceiro (pode chamar de novo para completar).
- Depois de registrar, ofereça o próximo passo: agendar a visita técnica pelo link ${L.agenda_visita || ""} ou receber contato da equipe. Calculadora e detalhes: ${L.parceiros || ""} (EN: ${L.en_parceiros || ""} · ES: ${L.es_parceiros || ""})
- Se alguém quiser só indicar um local (não é dono), agradeça, colete o local e um contato, e chame registrar_parceiro com tipo "Indicação". Não prometa recompensa.

# Outros links
Site: ${kb.empresa?.site || ""} (EN ${L.en || ""} · ES ${L.es || ""}) · Instagram: ${L.instagram || ""} · LinkedIn: ${L.linkedin || ""} · Sobre: ${L.sobre || ""}

# Formato da resposta
Escreva só a mensagem para a pessoa. Depois, em linhas separadas no final:
BOTOES: até 2 opções curtas de resposta (máx. 20 caracteres cada, no idioma da pessoa), separadas por " | ", que façam sentido como próximo passo. Omita se não houver. Não inclua o botão de falar com pessoa: ele é adicionado automaticamente.
IDIOMA: pt, en ou es (o idioma em que você respondeu).`;
}

// ---------- Ferramentas ----------
const FERRAMENTAS = [
  {
    name: "chamar_pessoa",
    description: "Avisa a equipe da CEBEL para assumir a conversa. Use quando a pessoa pedir, estiver frustrada, houver problema num carregador, cobrança/reembolso, negociação avançada ou você não conseguir resolver.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo curto, ex.: 'pediu atendente', 'carregador parado em Itaguaí'" },
        resumo: { type: "string", description: "Resumo completo para a equipe: quem é, o que quer, o que já foi dito e respondido, dados coletados. A pessoa não deve precisar repetir nada." },
        urgencia: { type: "string", enum: ["normal", "alta"] },
      },
      required: ["motivo", "resumo", "urgencia"],
    },
  },
  {
    name: "registrar_parceiro",
    description: "Registra na planilha de leads um dono/gestor de estacionamento interessado em ter um eletroposto (ou uma indicação de local). Pode ser chamada de novo para completar dados.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" }, negocio: { type: "string" },
        tipo: { type: "string", description: "Academia, Shopping ou centro comercial, Supermercado ou atacarejo, Hotel ou pousada, Restaurante, Estacionamento ou posto, Indicação, Outro" },
        cidade_bairro: { type: "string" }, vagas: { type: "string" },
        contato: { type: "string", description: "WhatsApp/telefone, se a pessoa informou" },
        observacoes: { type: "string", description: "Tudo que ajuda a equipe: interesse, cargo, horário, perguntas feitas, estimativa mostrada" },
      },
      required: ["nome", "negocio", "cidade_bairro"],
    },
  },
  {
    name: "estimar_receita",
    description: "Calcula quanto um carregador pode render por mês para o local parceiro, com as mesmas premissas da calculadora do site.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["ac", "dc"], description: "ac = recarga lenta 7 kW (permanência longa); dc = rápida 40 kW (alto giro)" },
        recargas_dia: { type: "number", description: "Opcional. Padrão: ac 3, dc 6" },
        kwh_por_recarga: { type: "number", description: "Opcional. Padrão: ac 18, dc 25" },
      },
      required: ["tipo"],
    },
  },
];

function estimar(kb, { tipo, recargas_dia, kwh_por_recarga }) {
  const c = kb.calculadora || { preco: 2, energia: 0.85, imposto: 0.1, repasse: 0.15, dias: 30, padrao: { ac: { recargas_dia: 3, kwh: 18 }, dc: { recargas_dia: 6, kwh: 25 } } };
  const p = c.padrao[tipo] || c.padrao.dc;
  const s = recargas_dia || p.recargas_dia, k = kwh_por_recarga || p.kwh;
  const kwhMes = s * k * c.dias, bruta = kwhMes * c.preco;
  const liquida = Math.max(0, bruta * (1 - c.imposto) - kwhMes * c.energia);
  const parte = liquida * c.repasse;
  const brl = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");
  return { premissas: `${s} recargas/dia × ${k} kWh, 30 dias, R$ ${c.preco}/kWh, energia R$ ${c.energia}/kWh paga pela CEBEL, ${c.imposto * 100}% impostos, repasse ${c.repasse * 100}% da receita líquida`,
    parte_do_local_mes: brl(parte), parte_do_local_ano: brl(parte * 12), energia_mes_kwh: Math.round(kwhMes), motoristas_mes: s * 30,
    aviso: "Estimativa ilustrativa, sem garantia. O estudo gratuito do local dá o número real." };
}

// ---------- Chamada ao Claude ----------
async function claude(env, body) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch(env.ANTHROPIC_URL || "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.json();
    if (r.status !== 429 && r.status < 500) throw new Error("Claude " + r.status + ": " + (await r.text()).slice(0, 300));
    await new Promise((ok) => setTimeout(ok, 800 * (tentativa + 1)));
  }
  throw new Error("Claude indisponível");
}

// historico: [{role, content}] com conteúdo em texto ou blocos (imagem).
// acoes: { chamarPessoa(input), registrarParceiro(input) } -> devolvem texto para o modelo.
export async function responder(env, { historico, contexto, acoes }) {
  const kb = await conhecimento(env);
  const h = horario(env);
  const system = [
    { type: "text", text: instrucoes(kb, env, h), cache_control: { type: "ephemeral" } },
    { type: "text", text: "# Esta conversa\n" + contexto },
  ];
  const msgs = historico.slice();
  let usouFerramenta = { pessoa: false, parceiro: false };
  for (let volta = 0; volta < 5; volta++) {
    const res = await claude(env, { model: env.MODEL || "claude-sonnet-5-5", max_tokens: 700, system, tools: FERRAMENTAS, messages: msgs });
    if (res.stop_reason !== "tool_use") {
      const texto = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return { ...interpretar(texto), usouFerramenta };
    }
    msgs.push({ role: "assistant", content: res.content });
    const resultados = [];
    for (const b of res.content.filter((x) => x.type === "tool_use")) {
      let out;
      try {
        if (b.name === "estimar_receita") out = JSON.stringify(estimar(kb, b.input));
        else if (b.name === "chamar_pessoa") { out = await acoes.chamarPessoa(b.input); usouFerramenta.pessoa = true; }
        else if (b.name === "registrar_parceiro") { out = await acoes.registrarParceiro(b.input); usouFerramenta.parceiro = true; }
        else out = "Ferramenta desconhecida";
      } catch (e) { out = "Erro: " + e.message + ". Diga que vai confirmar com a equipe e chame uma pessoa se ainda não chamou."; }
      resultados.push({ type: "tool_result", tool_use_id: b.id, content: out });
    }
    msgs.push({ role: "user", content: resultados });
  }
  return { texto: "", botoes: [], idioma: null, usouFerramenta };
}

export function interpretar(texto) {
  let botoes = [], idioma = null;
  const linhas = texto.split("\n").filter((l) => {
    const b = l.match(/^\s*BOT(?:O|Õ)ES\s*:\s*(.*)$/i);
    if (b) { botoes = b[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 2); return false; }
    const i = l.match(/^\s*IDIOMA\s*:\s*(pt|en|es)/i);
    if (i) { idioma = i[1].toLowerCase(); return false; }
    return true;
  });
  return { texto: linhas.join("\n").trim(), botoes, idioma };
}

// Pedido explícito de humano: resolve sem esperar o modelo.
const PEDE_PESSOA = /\b(atendente|humano|human|pessoa de verdade|falar com (uma |alguém|alguem|algu[eé]m|a )?(pessoa|gente|algu[eé]m|atendente|humano)|real person|talk to (a |an )?(person|human|agent|someone)|agent|persona|hablar con (una |un )?(persona|humano|agente|alguien))\b/i;
export function pedePessoa(texto) {
  const t = (texto || "").trim();
  return t.length < 120 && PEDE_PESSOA.test(t);
}
export function idiomaProvavel(texto) {
  const t = " " + (texto || "").toLowerCase() + " ";
  if (/ (the|hi|hello|how|where|can|i|my|is|charge|charger) /.test(t)) return "en";
  if (/ (hola|dónde|donde|cómo|quiero|puedo|cargar|cargador|gracias|usted) /.test(t)) return "es";
  return null;
}
