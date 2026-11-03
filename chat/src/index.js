// Atendimento da CEBEL no WhatsApp e no Instagram (Cloudflare Worker).
// Rotas:
//   GET/POST /webhook/whatsapp   webhook da API do WhatsApp (Cloud API, modo coexistência)
//   GET/POST /webhook/instagram  webhook da API do Instagram
//   GET      /teste?senha=...    página para conversar com o assistente pelo navegador
//   POST     /teste/msg          usado pela página de teste
//   POST     /config/instagram   cria o menu fixo e as perguntas iniciais do Instagram (?senha=...)
//   GET      /                   status

import { responder, horario, pedePessoa, idiomaProvavel, TXT } from "./brain.js";
import PAGINA_TESTE from "./teste.html";

const HIST_MAX = 30;

export default {
  // Toda segunda de manhã: renova a chave do Instagram (ela vence em 60 dias se não for renovada).
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(renovarInstagram(env).then((r) => console.log("renovação instagram", JSON.stringify(r))));
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (p === "/") return json({ ok: true, servico: "CEBEL atendimento", whatsapp: !!env.WHATSAPP_TOKEN, instagram: !!env.INSTAGRAM_TOKEN, claude: !!env.ANTHROPIC_API_KEY, senha_teste: !!senhaAdmin(env), telegram: !!env.TELEGRAM_BOT_TOKEN, versao: 8 });
      if (p === "/webhook/whatsapp" || p === "/webhook/instagram") {
        if (req.method === "GET") return verificar(url, env);
        const corpo = await req.text();
        if (!(await assinaturaOk(req, corpo, env, p.endsWith("instagram")))) return new Response("assinatura", { status: 401 });
        const dados = JSON.parse(corpo || "{}");
        ctx.waitUntil((p.endsWith("whatsapp") ? recebeWhatsApp(dados, env) : recebeInstagram(dados, env)).catch((e) => console.log("erro", e.stack || e)));
        return new Response("ok");
      }
      if (p === "/teste") {
        if (!senhaOk(url, env)) return new Response("Senha inválida. Use /teste?senha=SUA_SENHA", { status: 401 });
        return new Response(PAGINA_TESTE, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (p === "/teste/msg" && req.method === "POST") {
        if (!senhaOk(url, env)) return json({ erro: "senha" }, 401);
        const { sessao, texto, botao } = await req.json();
        const stub = conversa(env, "web:" + String(sessao).slice(0, 40));
        const r = await stub.fetch("https://do/entrada", { method: "POST", body: JSON.stringify({ canal: "web", usuario: sessao, texto, botao, nome: "Teste", retornar: true }) });
        return new Response(r.body, { headers: { "content-type": "application/json" } });
      }
      if (p === "/config/instagram-renovar") {
        if (!senhaOk(url, env)) return json({ erro: "senha" }, 401);
        return json(await renovarInstagram(env));
      }
      if (p === "/config/telegram") {
        if (!senhaOk(url, env)) return json({ erro: "senha" }, 401);
        return json(await configurarTelegram(env));
      }
      if (p === "/config/instagram" && req.method === "POST") {
        if (!senhaOk(url, env)) return json({ erro: "senha" }, 401);
        return json(await configurarInstagram(env));
      }
      return new Response("não encontrado", { status: 404 });
    } catch (e) {
      console.log("erro", e.stack || e);
      return json({ erro: String(e.message || e) }, 500);
    }
  },
};

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
// Senha tolerante a espaço sobrando e maiúscula/minúscula (o teclado do celular costuma mudar isso).
const normSenha = (x) => String(x || "").trim().toLowerCase();
// Aceita o segredo mesmo se o nome foi digitado com espaço, minúsculas ou hífen (ex.: "admin senha").
const senhaAdmin = (env) => env.ADMIN_SENHA || env.ADMIN_TEST_PASSWORD || Object.entries(env).find(([k, v]) => typeof v === "string" && k.replace(/[^a-z]/gi, "").toLowerCase() === "adminsenha")?.[1];
const senhaOk = (url, env) => !!senhaAdmin(env) && normSenha(url.searchParams.get("senha")) === normSenha(senhaAdmin(env));
const conversa = (env, chave) => env.CONVERSA.get(env.CONVERSA.idFromName(chave));
const GRAPH = (env) => env.GRAPH_VERSION || "v23.0";

function verificar(url, env) {
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env.VERIFY_TOKEN)
    return new Response(url.searchParams.get("hub.challenge"));
  return new Response("token inválido", { status: 403 });
}

async function assinaturaOk(req, corpo, env, instagram) {
  const segredo = instagram ? env.INSTAGRAM_APP_SECRET || env.META_APP_SECRET : env.META_APP_SECRET;
  if (!segredo) return true; // sem segredo configurado, não verifica (só para teste)
  const assin = (req.headers.get("x-hub-signature-256") || "").replace("sha256=", "");
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === assin;
}

// ---------------- WhatsApp: entrada ----------------
async function recebeWhatsApp(d, env) {
  for (const entry of d.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    if (ch.field === "smb_message_echoes") {
      // Mensagem enviada por uma pessoa no app WhatsApp Business: a equipe assumiu.
      for (const m of v.message_echoes || []) await conversa(env, "wa:" + m.to).fetch("https://do/humano", { method: "POST", body: JSON.stringify({ id: m.id }) });
      continue;
    }
    if (ch.field !== "messages") continue;
    const nomes = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name || ""]));
    for (const m of v.messages || []) {
      const e = { canal: "whatsapp", usuario: m.from, msgId: m.id, nome: nomes[m.from] || "" };
      if (m.type === "text") e.texto = m.text.body;
      else if (m.type === "interactive") { const r = m.interactive.button_reply || m.interactive.list_reply || {}; e.botao = r.id; e.texto = r.title; }
      else if (m.type === "button") { e.botao = m.button.payload; e.texto = m.button.text; }
      else if (m.type === "image" || m.type === "sticker") { e.midia = { tipo: "imagem", waId: m[m.type].id }; e.texto = m.image?.caption || ""; }
      else if (m.type === "location") e.texto = `[Localização enviada: ${m.location.name || ""} ${m.location.address || ""} (${m.location.latitude}, ${m.location.longitude})]`;
      else if (m.type === "audio" || m.type === "voice") e.audio = true;
      else if (m.type === "document" || m.type === "video") e.texto = `[A pessoa enviou um ${m.type === "video" ? "vídeo" : "documento"}${m[m.type]?.caption ? ": " + m[m.type].caption : ""}]`;
      else if (m.type === "reaction") continue;
      else e.texto = "[mensagem de um tipo não suportado]";
      await conversa(env, "wa:" + m.from).fetch("https://do/entrada", { method: "POST", body: JSON.stringify(e) });
    }
  }
}

// ---------------- Instagram: entrada ----------------
async function recebeInstagram(d, env) {
  for (const entry of d.entry || []) for (const ev of entry.messaging || []) {
    const conta = entry.id;
    if (ev.message?.is_echo) {
      // Eco de mensagem enviada pela conta. Se não foi o robô, a equipe assumiu.
      await conversa(env, "ig:" + ev.recipient.id).fetch("https://do/humano", { method: "POST", body: JSON.stringify({ id: ev.message.mid, app: ev.message.app_id }) });
      continue;
    }
    if (ev.sender?.id === conta || !(ev.message || ev.postback)) continue;
    const e = { canal: "instagram", usuario: ev.sender.id, msgId: ev.message?.mid || "pb" + ev.timestamp };
    if (ev.postback) { e.botao = ev.postback.payload; e.texto = ev.postback.title; }
    else if (ev.message.quick_reply) { e.botao = ev.message.quick_reply.payload; e.texto = ev.message.text; }
    else if (ev.message.text) e.texto = ev.message.text;
    const anexos = ev.message?.attachments || [];
    const img = anexos.find((a) => a.type === "image");
    if (img) e.midia = { tipo: "imagem", url: img.payload.url };
    else if (anexos.some((a) => a.type === "audio")) e.audio = true;
    else if (anexos.length && !e.texto) e.texto = `[A pessoa compartilhou: ${anexos.map((a) => a.type).join(", ")}${anexos[0].payload?.title ? " · " + anexos[0].payload.title : ""}]`;
    if (ev.message?.reply_to?.story) e.texto = `[Respondeu a um story da CEBEL] ${e.texto || ""}`;
    if (!e.texto && !e.midia && !e.audio) continue;
    await conversa(env, "ig:" + ev.sender.id).fetch("https://do/entrada", { method: "POST", body: JSON.stringify(e) });
  }
}

// ---------------- Conversa (uma por pessoa, guarda o estado) ----------------
export class Conversa {
  constructor(state, env) { this.state = state; this.env = env; }

  async carregar() {
    this.s = (await this.state.storage.get("s")) || {
      canal: null, usuario: null, nome: "", idioma: null, hist: [], vistos: [], enviados: [],
      humanoDesde: 0, humanoUltimo: 0, pedidoEm: 0, lembrado: false, lead: null, criadoEm: Date.now(),
    };
  }
  async salvar() { await this.state.storage.put("s", this.s); }

  async fetch(req) {
    await this.carregar();
    const rota = new URL(req.url).pathname;
    const b = await req.json();
    if (rota === "/humano") return this.humanoAssumiu(b);
    if (rota === "/entrada") return this.entrada(b);
    if (rota === "/cfg-get") return json((await this.state.storage.get("cfg")) || {});
    if (rota === "/cfg-set") { const atual = (await this.state.storage.get("cfg")) || {}; await this.state.storage.put("cfg", { ...atual, ...b }); return json({ ok: true }); }
    return new Response("?", { status: 404 });
  }

  // A equipe respondeu pelo app: o robô fica quieto.
  async humanoAssumiu({ id, app }) {
    if (this.s.enviados.includes(id)) return new Response("robô");
    if (app && this.env.META_APP_ID && String(app) === String(this.env.META_APP_ID)) return new Response("robô");
    this.s.humanoUltimo = Date.now();
    if (!this.s.humanoDesde) this.s.humanoDesde = Date.now();
    this.s.pedidoEm = 0; this.s.lembrado = false;
    await this.salvar();
    return new Response("humano");
  }

  emModoHumano() {
    const horas = +(this.env.HUMANO_HORAS || 12);
    return this.s.humanoUltimo && Date.now() - this.s.humanoUltimo < horas * 3600 * 1000;
  }

  async entrada(e) {
    const s = this.s;
    if (e.msgId && s.vistos.includes(e.msgId)) return json({ duplicada: true });
    if (e.msgId) s.vistos = [...s.vistos, e.msgId].slice(-50);
    s.canal = e.canal; s.usuario = e.usuario;
    if (e.nome) s.nome = e.nome;
    if (!s.idioma) s.idioma = idiomaProvavel(e.texto);

    const saidas = [];
    const enviar = async (texto, botoes, opts = {}) => {
      saidas.push({ texto, botoes });
      if (e.canal === "web") return;
      const ids = await enviarCanal(this.env, s, texto, botoes, opts);
      s.enviados = [...s.enviados, ...ids].slice(-60);
    };

    // Registro no histórico (texto do usuário)
    const textoUsuario = e.audio ? "[A pessoa mandou um áudio]" : e.texto || (e.midia ? "[foto]" : "");

    // 1) Equipe já está na conversa: só registra e deixa a pessoa com o humano.
    if (this.emModoHumano()) {
      s.hist.push({ role: "user", content: textoUsuario });
      s.hist = s.hist.slice(-HIST_MAX);
      await this.salvar();
      return json({ saidas: [{ texto: "(equipe atendendo: robô em silêncio)", botoes: [] }] });
    }

    if (e.canal !== "web") digitando(this.env, s, e.msgId).catch(() => {});

    // 2) Pedido explícito de pessoa (botão ou texto): resposta imediata, sem esperar o modelo.
    const idi = s.idioma || "pt";
    if (e.botao === "PESSOA" || pedePessoa(e.texto)) {
      s.hist.push({ role: "user", content: textoUsuario });
      await this.chamarPessoa({ motivo: "Pediu para falar com uma pessoa", resumo: resumoAutomatico(s), urgencia: "normal" });
      const msg = mensagemHandoff(this.env, idi, s.nome);
      s.hist.push({ role: "assistant", content: msg + "\n[chamei a equipe]" });
      await enviar(msg, [], { semPessoa: true });
      s.hist = s.hist.slice(-HIST_MAX);
      await this.salvar();
      return json({ saidas });
    }

    // 3) Áudio: ainda não ouvimos. Pede texto ou oferece pessoa.
    if (e.audio) {
      s.hist.push({ role: "user", content: textoUsuario });
      const msg = { pt: "Ainda não consigo ouvir áudios 🙏 Pode me escrever em texto? Se preferir, toque abaixo e chamo alguém da equipe.",
        en: "I can't listen to voice messages yet 🙏 Could you type it? Or tap below and I'll get someone from the team.",
        es: "Todavía no puedo escuchar audios 🙏 ¿Puede escribirlo? O toque abajo y llamo a alguien del equipo." }[idi];
      s.hist.push({ role: "assistant", content: msg });
      await enviar(msg, []);
      await this.salvar();
      return json({ saidas });
    }

    // 4) Assistente responde.
    const conteudo = [];
    if (e.midia) {
      const img = await baixarImagem(this.env, e.midia).catch(() => null);
      if (img) conteudo.push({ type: "image", source: { type: "base64", media_type: img.tipo, data: img.b64 } });
    }
    conteudo.push({ type: "text", text: textoUsuario || "[foto]" });
    const anteriores = limparHist(s.hist);
    if (anteriores.length && anteriores[anteriores.length - 1].role === "user") {
      // Mensagens que chegaram sem resposta (ex.: enquanto a equipe atendia) entram junto com a nova.
      conteudo[conteudo.length - 1].text = anteriores.pop().content + "\n" + conteudo[conteudo.length - 1].text;
    }
    const historico = [...anteriores, { role: "user", content: conteudo }];
    const primeira = s.hist.filter((m) => m.role === "assistant").length === 0;

    const contexto = [
      `Canal: ${{ whatsapp: "WhatsApp", instagram: "Instagram Direct", web: "página de teste" }[e.canal]}`,
      s.nome ? `Nome no perfil: ${s.nome}` : "",
      e.canal === "whatsapp" ? `Número de WhatsApp da pessoa: +${s.usuario} (não precisa pedir)` : "",
      e.canal === "instagram" ? "No Instagram você não tem o telefone: peça o WhatsApp se for um lead de parceiro." : "",
      primeira ? "É a PRIMEIRA resposta desta conversa: cumprimente, diga em poucas palavras que é o assistente virtual da CEBEL e que pode chamar uma pessoa da equipe a qualquer momento." : "",
      s.lead ? `Lead já registrado: ${JSON.stringify(s.lead)}` : "",
      s.pedidoEm ? "A equipe JÁ foi chamada nesta conversa e ainda não respondeu. Não chame de novo, a menos que surja algo novo e urgente." : "",
    ].filter(Boolean).join("\n");

    let r;
    try {
      r = await responder(this.env, {
        historico, contexto,
        acoes: {
          chamarPessoa: async (inp) => { await this.chamarPessoa(inp); const h = horario(this.env); return `Equipe avisada. ${h.aberto ? "Estamos no horário: normalmente respondem em poucos minutos." : "Fora do horário (" + h.texto + "): respondem no início do próximo horário."} A pessoa só precisa aguardar nesta conversa.`; },
          registrarParceiro: async (inp) => { await this.registrarParceiro(inp); return "Registrado na planilha de leads e equipe avisada."; },
        },
      });
    } catch (err) {
      console.log("erro claude", err.message);
      r = { texto: { pt: "Tive um probleminha aqui agora. Já chamei alguém da equipe para continuar com você 🙏", en: "I hit a small problem just now. I've already called someone from the team to continue with you 🙏", es: "Tuve un pequeño problema ahora. Ya llamé a alguien del equipo para seguir con usted 🙏" }[idi], botoes: [], usouFerramenta: {} };
      await this.chamarPessoa({ motivo: "Erro técnico no assistente", resumo: resumoAutomatico(s) + "\nÚltima mensagem: " + textoUsuario, urgencia: "normal" });
    }
    if (r.idioma) s.idioma = r.idioma;
    s.hist.push({ role: "user", content: textoUsuario });
    s.hist.push({ role: "assistant", content: r.texto + (r.usouFerramenta?.pessoa ? "\n[chamei a equipe]" : "") + (r.usouFerramenta?.parceiro ? "\n[lead registrado]" : "") });
    s.hist = s.hist.slice(-HIST_MAX);
    // Primeira mensagem: oferece os caminhos principais.
    let botoes = r.botoes || [];
    if (primeira && !botoes.length) botoes = TXT.menu[s.idioma || "pt"].slice(0, 2);
    await enviar(r.texto || "…", botoes, { semPessoa: !!r.usouFerramenta?.pessoa });
    await this.salvar();
    return json({ saidas });
  }

  async chamarPessoa({ motivo, resumo, urgencia }) {
    const s = this.s;
    if (!s.pedidoEm) s.pedidoEm = Date.now();
    s.lembrado = false;
    const quem = await perfil(this.env, s);
    const onde = s.canal === "whatsapp" ? `WhatsApp +${s.usuario} → responda pelo app WhatsApp Business da CEBEL` : s.canal === "instagram" ? `Instagram ${quem.usuario ? "@" + quem.usuario : "(id " + s.usuario + ")"} → responda pela caixa de mensagens do @cebel_rj` : "página de teste";
    const titulo = `${urgencia === "alta" ? "🔴 URGENTE · " : ""}Atendimento: ${motivo}`;
    const texto = `${titulo}\nQuem: ${s.nome || quem.nome || "sem nome"}\nOnde: ${onde}\n\n${resumo}`;
    await alertar(this.env, { titulo, texto, s, assunto: "Atendimento humano: " + motivo, mensagem: resumo });
    // Lembrete se ninguém responder em 10 minutos (no horário).
    await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
  }

  async registrarParceiro(inp) {
    const s = this.s;
    s.lead = { ...(s.lead || {}), ...Object.fromEntries(Object.entries(inp).filter(([, v]) => v)) };
    const quem = await perfil(this.env, s);
    const contato = inp.contato || (s.canal === "whatsapp" ? "+" + s.usuario : "");
    await planilha(this.env, {
      formulario: "chat-" + s.canal, origem: s.canal === "web" ? "teste" : s.canal,
      campos: { Nome: inp.nome, WhatsApp: contato, "Negócio": inp.negocio, Tipo: inp.tipo || "", Local: inp.cidade_bairro, Vagas: inp.vagas || "",
        Assunto: inp.tipo === "Indicação" ? "Indicação de local (chat)" : "Quero um eletroposto no meu negócio (chat)",
        Mensagem: (inp.observacoes || "") + (s.canal === "instagram" && quem.usuario ? `\nInstagram: @${quem.usuario}` : "") },
    });
    await telegram(this.env, `🟢 Novo lead de parceiro (${s.canal})\n${inp.nome} · ${inp.negocio} · ${inp.cidade_bairro}${inp.vagas ? " · " + inp.vagas + " vagas" : ""}\nContato: ${contato || (quem.usuario ? "@" + quem.usuario : "-")}\n${inp.observacoes || ""}`);
  }

  // Lembrete: ninguém respondeu ainda.
  async alarm() {
    await this.carregar();
    const s = this.s;
    if (!s.pedidoEm || s.lembrado || this.emModoHumano()) return;
    const h = horario(this.env);
    if (!h.aberto) { await this.state.storage.setAlarm(Date.now() + 30 * 60 * 1000); return; } // tenta de novo quando abrir
    s.lembrado = true;
    await this.salvar();
    await telegram(this.env, `⏰ ${s.nome || "Cliente"} (${s.canal}) está esperando uma pessoa há ${Math.round((Date.now() - s.pedidoEm) / 60000)} min.`);
  }
}

// ---------------- Mensagens fixas ----------------
function mensagemHandoff(env, idi, nome) {
  const h = horario(env);
  const n = nome ? ", " + nome.split(" ")[0] : "";
  if (idi === "en") return h.aberto
    ? `Sure${n}! I've already called someone from the CEBEL team. They usually reply here within a few minutes, and you won't need to repeat anything: I've passed on our conversation.`
    : `Sure${n}! I've already notified the CEBEL team. We're outside our hours right now (${h.en}, Brazil time), so they'll reply here first thing when we open. I've passed on our conversation, so you won't need to repeat anything.`;
  if (idi === "es") return h.aberto
    ? `¡Claro${n}! Ya llamé a alguien del equipo de CEBEL. Suelen responder aquí en pocos minutos, y no necesitará repetir nada: ya les pasé nuestra conversación.`
    : `¡Claro${n}! Ya avisé al equipo de CEBEL. Ahora estamos fuera del horario (${h.es}, hora de Brasil), así que le responderán aquí apenas abramos. Ya les pasé nuestra conversación, no necesitará repetir nada.`;
  return h.aberto
    ? `Claro${n}! Já chamei uma pessoa da equipe da CEBEL. Normalmente respondem aqui em poucos minutos, e você não vai precisar repetir nada: já passei nossa conversa.`
    : `Claro${n}! Já avisei a equipe da CEBEL. Agora estamos fora do horário de atendimento (${h.texto}), então respondem aqui logo no início do próximo horário. Já passei nossa conversa, você não vai precisar repetir nada.`;
}

function resumoAutomatico(s) {
  const ult = s.hist.slice(-8).map((m) => (m.role === "user" ? "Cliente: " : "Assistente: ") + (typeof m.content === "string" ? m.content : "[mídia]")).join("\n");
  return (s.lead ? "Lead: " + JSON.stringify(s.lead) + "\n" : "") + (ult ? "Últimas mensagens:\n" + ult : "Conversa recém-iniciada.");
}

function limparHist(hist) {
  // A API exige alternância e começar pelo usuário.
  const out = [];
  for (const m of hist) {
    const c = typeof m.content === "string" ? m.content : "[mídia]";
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += "\n" + c;
    else out.push({ role: m.role, content: c });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.filter((m) => m.content);
}

// ---------------- Envio ----------------
async function enviarCanal(env, s, texto, botoes, { semPessoa } = {}) {
  const idi = s.idioma || "pt";
  const b = [...new Set(botoes.map((x) => x.slice(0, 20)))].slice(0, 2).map((t) => ({ id: "Q:" + t, titulo: t }));
  if (!semPessoa) b.push({ id: "PESSOA", titulo: TXT.pessoa_btn[idi] });
  if (s.canal === "whatsapp") return enviarWhatsApp(env, s.usuario, texto, b);
  if (s.canal === "instagram") return enviarInstagram(env, s.usuario, texto, b);
  return [];
}

async function graph(env, url, token, body) {
  const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) console.log("graph erro", r.status, JSON.stringify(out).slice(0, 400));
  return out;
}

async function enviarWhatsApp(env, para, texto, botoes) {
  const url = `${env.FB_BASE || "https://graph.facebook.com"}/${GRAPH(env)}/${env.WHATSAPP_PHONE_ID}/messages`;
  const partes = dividir(texto, botoes.length ? 1000 : 4000);
  const ids = [];
  for (let i = 0; i < partes.length; i++) {
    const ultima = i === partes.length - 1;
    const body = ultima && botoes.length
      ? { messaging_product: "whatsapp", to: para, type: "interactive", interactive: { type: "button", body: { text: partes[i] },
          action: { buttons: botoes.map((x) => ({ type: "reply", reply: { id: x.id.slice(0, 256), title: x.titulo.slice(0, 20) } })) } } }
      : { messaging_product: "whatsapp", to: para, type: "text", text: { body: partes[i], preview_url: true } };
    const out = await graph(env, url, env.WHATSAPP_TOKEN, body);
    if (out.messages?.[0]?.id) ids.push(out.messages[0].id);
  }
  return ids;
}

async function enviarInstagram(env, para, texto, botoes) {
  const url = `${env.IG_BASE || "https://graph.instagram.com"}/${GRAPH(env)}/me/messages`;
  const partes = dividir(texto, 990);
  const ids = [];
  for (let i = 0; i < partes.length; i++) {
    const msg = { text: partes[i] };
    if (i === partes.length - 1 && botoes.length) msg.quick_replies = botoes.map((x) => ({ content_type: "text", title: x.titulo.slice(0, 20), payload: x.id }));
    const out = await graph(env, url, await igTok(env), { recipient: { id: para }, message: msg });
    if (out.message_id) ids.push(out.message_id);
  }
  return ids;
}

async function digitando(env, s, msgId) {
  if (s.canal === "whatsapp" && msgId)
    await graph(env, `${env.FB_BASE || "https://graph.facebook.com"}/${GRAPH(env)}/${env.WHATSAPP_PHONE_ID}/messages`, env.WHATSAPP_TOKEN,
      { messaging_product: "whatsapp", status: "read", message_id: msgId, typing_indicator: { type: "text" } });
  if (s.canal === "instagram") {
    const url = `${env.IG_BASE || "https://graph.instagram.com"}/${GRAPH(env)}/me/messages`;
    await graph(env, url, await igTok(env), { recipient: { id: s.usuario }, sender_action: "mark_seen" });
    await graph(env, url, await igTok(env), { recipient: { id: s.usuario }, sender_action: "typing_on" });
  }
}

function dividir(t, max) {
  if (t.length <= max) return [t];
  const out = []; let resto = t;
  while (resto.length > max) {
    let corte = resto.lastIndexOf("\n", max); if (corte < max * 0.5) corte = resto.lastIndexOf(". ", max) + 1; if (corte < max * 0.5) corte = max;
    out.push(resto.slice(0, corte).trim()); resto = resto.slice(corte).trim();
  }
  if (resto) out.push(resto);
  return out;
}

async function baixarImagem(env, midia) {
  let url = midia.url, headers = {};
  if (midia.waId) {
    const info = await (await fetch(`${env.FB_BASE || "https://graph.facebook.com"}/${GRAPH(env)}/${midia.waId}`, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } })).json();
    url = info.url; headers = { Authorization: "Bearer " + env.WHATSAPP_TOKEN };
  }
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  let tipo = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(tipo)) tipo = "image/jpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > 4.5 * 1024 * 1024) return null;
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { tipo, b64: btoa(bin) };
}

async function perfil(env, s) {
  if (s.canal !== "instagram" || !env.INSTAGRAM_TOKEN) return {};
  if (s.perfil) return s.perfil;
  try {
    const r = await fetch(`${env.IG_BASE || "https://graph.instagram.com"}/${GRAPH(env)}/${s.usuario}?fields=name,username`, { headers: { Authorization: "Bearer " + (await igTok(env)) } });
    const j = await r.json();
    s.perfil = { nome: j.name || "", usuario: j.username || "" };
    if (!s.nome && j.name) s.nome = j.name;
  } catch (e) { s.perfil = {}; }
  return s.perfil;
}

// ---------------- Avisos para a equipe ----------------
async function alertar(env, { texto, s, assunto, mensagem }) {
  const quem = s.perfil || {};
  await Promise.allSettled([
    telegram(env, texto),
    planilha(env, { formulario: "chat-atendimento", origem: s.canal === "web" ? "teste" : s.canal,
      campos: { Nome: s.nome || quem.nome || "(sem nome)", WhatsApp: s.canal === "whatsapp" ? "+" + s.usuario : "", Tipo: s.lead ? s.lead.tipo || "" : "Motorista",
        "Negócio": s.lead?.negocio || "", Local: s.lead?.cidade_bairro || "", Assunto: assunto,
        Mensagem: mensagem + (quem.usuario ? `\nInstagram: @${quem.usuario}` : "") } }),
  ]);
}

async function telegram(env, texto) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  let ids = String(env.TELEGRAM_CHAT_ID || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!ids.length) ids = await idsTelegramSalvos(env);
  for (const chat of ids) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: texto.slice(0, 4000), disable_web_page_preview: true }),
    }).catch(() => {});
  }
}

// IDs do Telegram guardados automaticamente (quem mandou "oi" para o bot de alertas).
const cfg = (env) => conversa(env, "__config__");
async function idsTelegramSalvos(env) {
  try { return (await (await cfg(env).fetch("https://do/cfg-get", { method: "POST", body: "{}" })).json()).telegram || []; } catch (e) { return []; }
}
async function configurarTelegram(env) {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, erro: "Falta o segredo TELEGRAM_BOT_TOKEN no Cloudflare" };
  const r = await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`)).json();
  if (!r.ok) return { ok: false, erro: "Token do Telegram inválido", detalhe: r.description };
  const pessoas = {};
  for (const u of r.result || []) { const c = (u.message || u.my_chat_member || {}).chat; if (c) pessoas[c.id] = c.first_name || c.title || c.username || String(c.id); }
  const antigos = await idsTelegramSalvos(env);
  const ids = [...new Set([...antigos, ...Object.keys(pessoas)])];
  await cfg(env).fetch("https://do/cfg-set", { method: "POST", body: JSON.stringify({ telegram: ids }) });
  await telegram(env, "✅ Alertas da CEBEL ligados! Você vai receber aqui: pedidos de atendimento humano, problemas em carregadores e novos leads de parceiros.");
  return { ok: true, avisos_vao_para: ids.map((i) => pessoas[i] || i), dica: ids.length ? "Pronto. Quem mais mandar 'oi' para o bot e abrir este link de novo também passa a receber." : "Ninguém encontrado: mande 'oi' para o bot no Telegram e abra este link de novo." };
}

async function planilha(env, { formulario, origem, campos }) {
  if (!env.LEADS_ENDPOINT) return;
  await fetch(env.LEADS_ENDPOINT, {
    method: "POST", headers: { "content-type": "text/plain" }, redirect: "follow",
    body: JSON.stringify({ token: env.LEADS_TOKEN || "cebel-leads", formulario, origem, meio: "chat", campanha: "", pagina: "", campos }),
  }).catch((e) => console.log("planilha erro", e.message));
}

// ---------------- Instagram: chave que se renova sozinha ----------------
let igCache = { em: 0, token: null };
async function igTok(env) {
  if (igCache.token && Date.now() - igCache.em < 3600 * 1000) return igCache.token;
  let salvo = null;
  try { salvo = (await (await cfg(env).fetch("https://do/cfg-get", { method: "POST", body: "{}" })).json()).ig; } catch (e) {}
  // Se o segredo foi trocado no Cloudflare depois da última renovação, vale o segredo novo.
  const token = salvo && salvo.origem === env.INSTAGRAM_TOKEN ? salvo.token : env.INSTAGRAM_TOKEN;
  igCache = { em: Date.now(), token };
  return token;
}
async function renovarInstagram(env) {
  if (!env.INSTAGRAM_TOKEN) return { ok: false, erro: "sem INSTAGRAM_TOKEN" };
  const atual = await igTok(env);
  const r = await (await fetch(`${env.IG_BASE || "https://graph.instagram.com"}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(atual)}`)).json();
  if (!r.access_token) return { ok: false, erro: r.error?.message || "falhou" };
  await cfg(env).fetch("https://do/cfg-set", { method: "POST", body: JSON.stringify({ ig: { token: r.access_token, origem: env.INSTAGRAM_TOKEN, em: Date.now() } }) });
  igCache = { em: Date.now(), token: r.access_token };
  return { ok: true, valido_por_dias: Math.round((r.expires_in || 0) / 86400) };
}

// ---------------- Instagram: menu fixo e perguntas iniciais ----------------
async function configurarInstagram(env) {
  const url = `${env.IG_BASE || "https://graph.instagram.com"}/${GRAPH(env)}/me/messenger_profile`;
  const ice = await graph(env, url, await igTok(env), {
    platform: "instagram",
    ice_breakers: [
      { locale: "default", call_to_actions: [
        { question: "Onde tem estação da CEBEL?", payload: "Q:Onde tem estação da CEBEL?" },
        { question: "Como faço para carregar?", payload: "Q:Como faço para carregar?" },
        { question: "Quero um eletroposto no meu negócio", payload: "Q:Quero um eletroposto no meu negócio" },
        { question: "Quero falar com uma pessoa", payload: "PESSOA" } ] },
      { locale: "en_US", call_to_actions: [
        { question: "Where are your chargers?", payload: "Q:Where are your chargers?" },
        { question: "How do I charge?", payload: "Q:How do I charge?" },
        { question: "I want a charger at my business", payload: "Q:I want a charger at my business" },
        { question: "Talk to a person", payload: "PESSOA" } ] },
      { locale: "es_LA", call_to_actions: [
        { question: "¿Dónde están sus cargadores?", payload: "Q:¿Dónde están sus cargadores?" },
        { question: "¿Cómo cargo mi auto?", payload: "Q:¿Cómo cargo mi auto?" },
        { question: "Quiero un cargador en mi negocio", payload: "Q:Quiero un cargador en mi negocio" },
        { question: "Hablar con una persona", payload: "PESSOA" } ] },
    ],
  });
  const menu = await graph(env, url, await igTok(env), {
    platform: "instagram",
    persistent_menu: [
      { locale: "default", composer_input_disabled: false, call_to_actions: [
        { type: "postback", title: "👤 Falar com uma pessoa", payload: "PESSOA" },
        { type: "postback", title: "⚡ Onde carregar", payload: "Q:Onde tem estação da CEBEL?" },
        { type: "postback", title: "🏢 Eletroposto no meu negócio", payload: "Q:Quero um eletroposto no meu negócio" } ] },
      { locale: "en_US", composer_input_disabled: false, call_to_actions: [
        { type: "postback", title: "👤 Talk to a person", payload: "PESSOA" },
        { type: "postback", title: "⚡ Where to charge", payload: "Q:Where are your chargers?" },
        { type: "postback", title: "🏢 Charger at my business", payload: "Q:I want a charger at my business" } ] },
    ],
  });
  return { ice_breakers: ice, persistent_menu: menu };
}
