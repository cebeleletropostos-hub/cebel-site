# Site da CEBEL

Site institucional da CEBEL Energia & Mobilidade Elétrica, publicado pelo GitHub Pages a partir da branch `main` (raiz). O GitHub Pages roda o Jekyll sozinho: não há build local nem GitHub Action. Todo push em `main` publica em ~1 minuto.

Endereço atual: https://cebeleletropostos-hub.github.io/cebel-site/

## Estrutura

- `_config.yml` — dados globais: WhatsApp, endereço, preço por kWh, repasse ao parceiro, `url` e `baseurl`.
- `_data/estacoes.yml` — lista de estações. Para adicionar ou mudar o status de uma estação, edite só este arquivo (status: `operando`, `instalacao`, `em-breve`). Home e /estacoes/ leem daqui, e os números da home são calculados a partir dele.
- `_layouts/default.html` — `<head>`, SEO/Open Graph, botão flutuante de WhatsApp, scripts.
- `_includes/` — `header.html` (menu), `footer.html`, `wa-done.html` (botões e resposta dos formulários).
- Páginas: `index.html` (home), `estacoes/`, `motoristas/`, `parceiros/` (landing de captação de anfitriões, com calculadora), `sobre/`, `contato/`, `404.html`.
- `assets/css/site.css` — todo o estilo. Cores e fontes são tokens no `:root`, com tema escuro.
  Identidade: azul do logo (#0A459F) e marinho (#061A3F) como campo, verde/amarelo da bandeira como energia.
  `.swash` = pincelada amarelo→lima atrás de palavras-chave (vem do logo); `.dark.agua` = fundo azul com textura de água;
  `.faixa` = listra verde/amarelo/azul. Fontes: Bricolage Grotesque (títulos), Figtree (texto), DM Mono (rótulos).
- `assets/img/logo-cebel.png` — logo redondo (recortado de um print; trocar pelo arquivo original quando houver).
- `_includes/station.html` (estação em operação: foto, endereço, botões Google Maps/Waze) e `station-mini.html` (a caminho).
  Fotos das estações vão em `assets/img/estacoes/` e o caminho entra no campo `foto` de `_data/estacoes.yml`.
- `assets/js/site.js` — menu móvel, formulários de WhatsApp, calculadora e filtro de estações.
- `assets/video/itaguai.mp4` — vídeo vertical da estação de Itaguaí (gravado por uma influenciadora; nome e cartão no app foram desfocados). Vídeo completo fica ao lado do passo a passo em /motoristas/; `itaguai-hero.mp4` é um recorte de 13 s, sem som e sem as legendas, usado como mídia no topo da home.
- `assets/img/og.png` — imagem de compartilhamento (gerada a partir de `tools/og.html`).

## Regras

- Links internos sempre com `{{ '/caminho/' | relative_url }}`, por causa do `baseurl`.
- Formulários: `<form class="wa" data-intro="...">`; todo campo com `data-label` entra na mensagem de WhatsApp. Não há backend.
- Textos em português do Brasil. A CEBEL pode citar a Smart Fit como parceira (Itaguaí, Rio das Ostras; Saquarema em breve).
- App de recarga: EzVolt, com créditos pré-pagos (a partir de R$ 20) por Pix ou cartão.
- Calculadora (premissas em `assets/js/site.js` e no texto de `parceiros/`): R$ 2,00/kWh, energia R$ 0,85/kWh, 10% de impostos, repasse 15% da receita líquida.
- Para conferir antes de publicar: `jekyll build` e abrir `_site/` num navegador headless.

## Domínio próprio (pendente)

Quando o domínio for comprado: criar o arquivo `CNAME` com o domínio, trocar `url` em `_config.yml` para `https://dominio` e `baseurl` para `""`. No registro.br, 4 registros A para 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 e CNAME `www` → `cebeleletropostos-hub.github.io`.
