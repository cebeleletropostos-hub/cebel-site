// Cenários ponta a ponta contra o worker local (wrangler dev) + mock.
const W = "http://127.0.0.1:8787", M = "http://127.0.0.1:8790";
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) process.exitCode = 1; };
const wa = (from, msg, extra = {}) => fetch(W + "/webhook/whatsapp", { method: "POST", body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: from, profile: { name: "Maria Souza" } }], messages: [{ from, id: "w" + Math.random(), ...msg }] } }] }], ...extra }) });
const espera0 = (ms) => new Promise((r) => setTimeout(r, ms));
// espera até o worker parar de produzir chamadas (o log fica estável por 1,2 s)
const espera = async (ms) => { let a = -1, b = 0, t = 0; await espera0(400); while (t < 20000) { b = (await (await fetch(M + "/log")).json()).length; if (b === a) { await espera0(800); const c = (await (await fetch(M + "/log")).json()).length; if (c === b) return; } a = b; await espera0(400); t += 400; } };
const log = async () => (await fetch(M + "/log")).json();
const envios = async (para) => (await log()).filter((x) => x.url.startsWith("/fb") && x.body?.to === para && x.body?.type).map((x) => x.body);

// verificação do webhook
let r = await fetch(W + "/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=v123&hub.challenge=42");
ok((await r.text()) === "42", "verificação do webhook da Meta");

// 1) primeira mensagem no WhatsApp: resposta com botões + botão de pessoa
await wa("5521911111111", { type: "text", text: { body: "oi" } }); await espera(3500);
let e = await envios("5521911111111"); if (e.length !== 1) console.log(JSON.stringify(e).slice(0, 600));
ok(e.length === 1 && e[0].type === "interactive", "primeira resposta é mensagem com botões");
const bts = e[0]?.interactive.action.buttons.map((b) => b.reply.title) || [];
ok(bts.includes("Falar com uma pessoa") && bts.length === 3, "botões: " + bts.join(" | "));
const claudeReq = (await log()).filter((x) => x.url === "/claude").pop().body;
const sys = claudeReq.system.map((s) => s.text).join("\n");
ok(/Smart Fit Itaguaí/.test(sys) && /Av\. Dep\. Octávio Cabral/.test(sys), "conhecimento do site (estações) entrou no prompt");
ok(/PRIMEIRA resposta/.test(sys) && /\+5521911111111/.test(sys), "contexto da conversa (primeira msg, número)");

// 2) toca no botão de pessoa: handoff imediato, aviso na planilha, sem chamar o Claude
const antes = (await log()).filter((x) => x.url === "/claude").length;
await wa("5521911111111", { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "PESSOA", title: "Falar com uma pessoa" } } }); await espera(3000);
e = await envios("5521911111111");
ok(/Já (chamei|avisei)/.test(e[1]?.text?.body || ""), "handoff: " + (e[1]?.text?.body || "").slice(0, 70) + "…");
ok((await log()).filter((x) => x.url === "/claude").length === antes, "handoff não esperou o modelo");
const lead = (await log()).filter((x) => x.url === "/leads").pop()?.body;
ok(lead && /Atendimento humano/.test(lead.campos.Assunto) && lead.origem === "whatsapp", "aviso de atendimento foi para a planilha (e e-mail)");

// 3) equipe responde pelo app (eco de coexistência): robô fica em silêncio
await fetch(W + "/webhook/whatsapp", { method: "POST", body: JSON.stringify({ entry: [{ changes: [{ field: "smb_message_echoes", value: { message_echoes: [{ from: "5521996948090", to: "5521911111111", id: "eco1", type: "text", text: { body: "Oi Maria, aqui é o João!" } }] } }] }] }) });
await espera(500);
await wa("5521911111111", { type: "text", text: { body: "oi joão, tudo bem?" } }); await espera(3000);
ok((await envios("5521911111111")).length === 2, "com a equipe na conversa, o robô não responde");

// 4) texto pedindo atendente em inglês
await wa("5521922222222", { type: "text", text: { body: "hello, can I talk to a human?" } }); await espera(3000);
e = await envios("5521922222222");
ok(/I've already/.test(e[0]?.text?.body || ""), "pedido de humano em inglês respondido em inglês");

// 5) lead de academia: estimativa + registro na planilha
await wa("5521933333333", { type: "text", text: { body: "tenho uma academia em Icaraí e quero um carregador" } }); await espera(3500);
const l = (await log()).filter((x) => x.url === "/leads" && x.body.formulario === "chat-whatsapp").pop()?.body;
ok(l && l.campos["Negócio"] === "Academia Teste" && l.campos.WhatsApp === "+5521933333333", "lead registrado com número do WhatsApp automático");
const tr = (await log()).filter((x) => x.url === "/claude").pop().body.messages.at(-1).content.map((c) => c.content).join(" ");
ok(/parte_do_local_mes/.test(tr), "estimativa calculada: " + tr.match(/parte_do_local_mes":"([^"]+)/)?.[1]);

// 6) áudio
await wa("5521944444444", { type: "audio", audio: { id: "a1" } }); await espera(2500);
ok(/áudios/.test((await envios("5521944444444"))[0]?.interactive?.body?.text || ""), "áudio: pede texto e oferece pessoa");

// 7) duplicata do mesmo webhook não responde duas vezes
const dup = { entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "5521955555555", id: "dup1", type: "text", text: { body: "oi" } }] } }] }] };
await fetch(W + "/webhook/whatsapp", { method: "POST", body: JSON.stringify(dup) });
await fetch(W + "/webhook/whatsapp", { method: "POST", body: JSON.stringify(dup) }); await espera(3500);
ok((await envios("5521955555555")).length === 1, "mensagem duplicada da Meta respondida uma vez só");

// 8) Instagram: mensagem, quick replies, eco do robô ignorado, eco humano pausa
const ig = (ev) => fetch(W + "/webhook/instagram", { method: "POST", body: JSON.stringify({ object: "instagram", entry: [{ id: "IGCEBEL", messaging: [ev] }] }) });
await ig({ sender: { id: "u1" }, recipient: { id: "IGCEBEL" }, timestamp: 1, message: { mid: "m1", text: "where can I charge?" } }); await espera(3500);
let igs = (await log()).filter((x) => x.url.includes("/me/messages") && x.body?.message);
ok(igs.length === 1 && igs[0].body.message.quick_replies.some((q) => q.payload === "PESSOA"), "Instagram: resposta com botão de pessoa (" + igs[0]?.body.message.quick_replies.map((q) => q.title).join(" | ") + ")");
await ig({ sender: { id: "IGCEBEL" }, recipient: { id: "u1" }, timestamp: 2, message: { mid: "mid.bot" + 0, is_echo: true, text: "x" } });
await ig({ sender: { id: "IGCEBEL" }, recipient: { id: "u1" }, timestamp: 3, message: { mid: "mHumano", is_echo: true, text: "Hi! João here" } }); await espera(400);
await ig({ sender: { id: "u1" }, recipient: { id: "IGCEBEL" }, timestamp: 4, message: { mid: "m2", text: "thanks!" } }); await espera(3000);
igs = (await log()).filter((x) => x.url.includes("/me/messages") && x.body?.message);
ok(igs.length === 1, "Instagram: equipe respondeu pelo app, robô em silêncio");

// 9) página de teste
r = await fetch(W + "/teste?senha=s3nha"); ok(r.ok && /Teste do atendimento/.test(await r.text()), "página de teste abre com senha");
ok((await fetch(W + "/teste?senha=errada")).status === 401, "página de teste bloqueada sem senha");
r = await (await fetch(W + "/teste/msg?senha=s3nha", { method: "POST", body: JSON.stringify({ sessao: "s1", texto: "o carregador está quebrado" }) })).json();
ok(r.saidas?.length === 1, "teste web responde: " + r.saidas?.[0]?.texto.slice(0, 50));
const urg = (await log()).filter((x) => x.url === "/leads").pop().body;
ok(/carregador parado/.test(urg.campos.Assunto), "problema no carregador vira aviso urgente para a equipe");
