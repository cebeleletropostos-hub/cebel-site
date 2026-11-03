# CEBEL · Atendimento automático (WhatsApp + Instagram)

Um único assistente (Claude) atende o WhatsApp e o Instagram da CEBEL, em português, inglês e espanhol.
Roda como Cloudflare Worker (grátis, sempre ligado). Código em `src/`.

## O que ele faz

- **Motoristas:** onde carregar (com links de Google Maps/Waze), preço, passo a passo do app EzVolt, compatibilidade, carregador com problema (aceita foto).
- **Donos de estacionamento:** explica o modelo, calcula quanto o local ganharia (mesmas premissas da calculadora do site), coleta os dados aos poucos e registra o lead na planilha `CEBEL · Leads` (origem `whatsapp` ou `instagram`, formulário `chat-…`). Oferece a agenda da visita técnica.
- **Falar com uma pessoa:** botão em toda mensagem ("Falar com uma pessoa"), mais o menu fixo do Instagram. Também entende pedidos escritos ("quero um atendente", "talk to a human", "hablar con una persona") e chama a equipe sozinho em caso de frustração, carregador parado, cobrança ou negociação.
  A pessoa recebe na hora a confirmação, com prazo honesto (no horário: poucos minutos; fora: início do próximo horário), e não precisa repetir nada: a equipe recebe um resumo.
- **Quando alguém da equipe responde pelo app** (WhatsApp Business ou Instagram), o robô fica em silêncio naquela conversa. Volta sozinho 12 h depois da última mensagem da equipe (`HUMANO_HORAS`).
- Áudio: pede para escrever ou oferece uma pessoa. Mensagem duplicada da Meta: responde uma vez só.

## De onde vem o conhecimento

Do próprio site: `bot.json` (gerado pelo Jekyll a partir de `_config.yml` e `_data/estacoes.yml`). Mudou preço, estação ou link no site → o robô sabe em até 10 minutos. Não há texto duplicado para manter.

## Avisos para a equipe

- **Planilha + e-mail** (já funciona): todo pedido de pessoa e todo lead vira linha na planilha de leads e o Apps Script manda e-mail para a conta da CEBEL. Pedidos de atendimento entram com Assunto "Atendimento humano: …" e formulário `chat-atendimento`.
- **Telegram** (desligado por escolha do João; e-mail basta): configure `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` (vários IDs separados por vírgula). Se ninguém responder em 10 min dentro do horário, chega um lembrete.

## Configuração (Cloudflare → Worker → Settings → Variables and Secrets)

Secretos: `ANTHROPIC_API_KEY`, `ADMIN_SENHA` (senha da página /teste), `VERIFY_TOKEN` (palavra combinada com a Meta),
`META_APP_SECRET` (assinatura dos webhooks), `META_APP_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`,
`INSTAGRAM_TOKEN`, `INSTAGRAM_APP_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

Variáveis (em `wrangler.toml`): `SITE_URL` (trocar quando o domínio novo entrar), `MODEL`, `HORARIO_TEXTO`, `HORA_INICIO`, `HORA_FIM`, `DIAS_ATENDIMENTO` (0 = domingo), `HUMANO_HORAS`, `LEADS_ENDPOINT`, `LEADS_TOKEN`.

## Endereços do Worker

- `/teste?senha=…` conversa de teste no navegador (canal "web", leads entram com origem `teste`).
- `/webhook/whatsapp` e `/webhook/instagram` URLs de callback na Meta. Campos do WhatsApp: `messages` e `smb_message_echoes` (coexistência). Instagram: `messages`.
- `POST /config/instagram?senha=…` cria as perguntas iniciais e o menu fixo do Instagram ("👤 Falar com uma pessoa").

## WhatsApp: o número fica com o André

Com a **coexistência** da Meta, o mesmo número funciona no app WhatsApp Business (no celular do André) e na API ao mesmo tempo, com as mensagens sincronizadas. A equipe continua respondendo pelo app. A Meta só libera esse modo por um parceiro oficial (Tech Provider / BSP), que encaminha os webhooks para `/webhook/whatsapp`.

## Testes

`npm install`, depois `node test/mock.mjs` (serviços falsos), `npx wrangler dev` com um `.dev.vars` apontando `ANTHROPIC_URL`, `FB_BASE`, `IG_BASE`, `SITE_URL` e `LEADS_ENDPOINT` para o mock, e `node test/teste.mjs` (20 cenários).

## Para funcionar para sempre

- Chave do Instagram: vence em 60 dias; o Worker renova sozinho toda segunda às 6h (cron) e guarda a nova. `GET /config/instagram-renovar?senha=…` força agora. Trocar o segredo `INSTAGRAM_TOKEN` no Cloudflare passa a valer na hora.
- WhatsApp: usar token permanente (usuário do sistema) no `WHATSAPP_TOKEN`.
- Claude: créditos com recarga automática ligada no console da Anthropic.
