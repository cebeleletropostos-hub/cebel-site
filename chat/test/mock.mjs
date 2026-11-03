// Servidor falso: Claude, Graph (WhatsApp/Instagram), planilha e site. Só para teste local.
import http from "node:http"; import fs from "node:fs";
const log = []; let n = 0;
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const j = body ? (() => { try { return JSON.parse(body) } catch { return body } })() : null;
  const send = (o, ct = "application/json") => { res.writeHead(200, { "content-type": ct }); res.end(typeof o === "string" ? o : JSON.stringify(o)); };
  if (req.url === "/log") return send(log);
  if (req.url === "/reset") { log.length = 0; return send({ ok: true }); }
  if (req.url.startsWith("/site/bot.json")) return send(fs.readFileSync("/tmp/claude-0/site/bot.json", "utf8"));
  log.push({ url: req.url, body: j });
  if (req.url.startsWith("/claude")) {
    const last = j.messages[j.messages.length - 1];
    const txt = JSON.stringify(last.content);
    if (last.content[0]?.type === "tool_result") {
      return send({ stop_reason: "end_turn", content: [{ type: "text", text: "Show, João! Uma academia com 6 recargas/dia renderia uns R$ 230/mês para você. Já registrei e a equipe vai falar com você.\nBOTOES: Agendar visita | Tirar dúvidas\nIDIOMA: pt" }] });
    }
    if (/academia/i.test(txt)) return send({ stop_reason: "tool_use", content: [
      { type: "tool_use", id: "t1", name: "estimar_receita", input: { tipo: "dc" } },
      { type: "tool_use", id: "t2", name: "registrar_parceiro", input: { nome: "João", negocio: "Academia Teste", cidade_bairro: "Niterói, Icaraí", tipo: "Academia", vagas: "21 a 50" } } ] });
    if (/broken|quebrado/i.test(txt)) return send({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t3", name: "chamar_pessoa", input: { motivo: "carregador parado", resumo: "Itaguaí não inicia", urgencia: "alta" } }] });
    return send({ stop_reason: "end_turn", content: [{ type: "text", text: "Oi! Sou o assistente virtual da CEBEL ⚡ Se quiser falar com uma pessoa, é só tocar no botão.\nBOTOES: Onde carregar | Quanto custa\nIDIOMA: " + (/hello|where/i.test(txt) ? "en" : "pt") }] });
  }
  if (req.url.startsWith("/fb") || req.url.startsWith("/ig")) return send({ messages: [{ id: "wamid.bot" + (++n) }], message_id: "mid.bot" + n });
  return send({ ok: true });
}).listen(8790, () => console.log("mock on 8790"));
