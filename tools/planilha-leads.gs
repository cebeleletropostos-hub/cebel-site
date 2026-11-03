/**
 * CEBEL · Planilha de leads
 *
 * Como usar (uma vez só, na conta Google da CEBEL):
 * 1. Crie uma planilha nova (sheets.new) e dê o nome "CEBEL · Leads".
 * 2. Menu Extensões → Apps Script. Apague o que estiver lá e cole este arquivo inteiro. Salve.
 * 3. No topo, escolha a função "configurar" e clique em Executar. Autorize quando o Google pedir.
 *    Isso monta as abas "Leads" e "Painel" com colunas, listas de status e cores.
 * 4. Clique em Implantar → Nova implantação → engrenagem → "App da Web".
 *    Executar como: Eu. Quem pode acessar: Qualquer pessoa. Clique em Implantar.
 * 5. Copie a URL que termina em /exec e mande para o Claude, que liga o site na planilha.
 *
 * A partir daí, todo formulário enviado no site vira uma linha nova com status "Novo",
 * e um e-mail de aviso chega na conta dona da planilha.
 * Leads que chegam por Instagram, telefone ou indicação você adiciona à mão numa linha nova.
 */

// Mesma palavra configurada em leads_token no site (_config.yml).
var TOKEN = 'cebel-leads';
// Aviso por e-mail a cada lead novo vindo do site (true = liga, false = desliga).
var AVISAR_POR_EMAIL = true;

var ABA_LEADS = 'Leads';
var ABA_PAINEL = 'Painel';
var COLUNAS = [
  'Data', 'Status', 'Nome', 'WhatsApp', 'Abrir conversa', 'Negócio', 'Tipo', 'Cidade / bairro', 'Vagas',
  'Assunto', 'Mensagem', 'Origem', 'Campanha', 'Formulário', 'Próximo passo', 'Data do próximo passo',
  'Responsável', 'Notas'
];
var STATUS = ['Novo', 'Em contato', 'Visita agendada', 'Proposta enviada', 'Fechado', 'Perdido'];
var CORES_STATUS = {
  'Novo': '#FFF4C2', 'Em contato': '#DCEBFF', 'Visita agendada': '#E6DCFF',
  'Proposta enviada': '#FFE3C7', 'Fechado': '#D5F2DF', 'Perdido': '#ECECEC'
};
var ORIGENS = ['site', 'instagram', 'meta', 'google', 'indicação', 'prospecção', 'whatsapp', 'telefone', 'direto', 'outro'];
var TIPOS = ['Academia', 'Shopping ou centro comercial', 'Supermercado ou atacarejo', 'Hotel ou pousada',
  'Restaurante', 'Estacionamento ou posto', 'Motorista', 'Outro'];

/** Monta (ou remonta) as abas da planilha. Pode rodar de novo sem perder linhas. */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetLocale('pt_BR');
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');

  var sh = ss.getSheetByName(ABA_LEADS);
  if (!sh) {
    sh = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0] : ss.insertSheet();
    sh.setName(ABA_LEADS);
  }
  var n = COLUNAS.length;
  sh.getRange(1, 1, 1, n).setValues([COLUNAS])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0A459F').setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
  if (sh.getMaxColumns() > n) sh.deleteColumns(n + 1, sh.getMaxColumns() - n);

  var larguras = [130, 140, 160, 130, 120, 180, 170, 160, 90, 190, 280, 110, 140, 100, 220, 150, 120, 260];
  larguras.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var linhas = Math.max(sh.getMaxRows() - 1, 999);
  if (sh.getMaxRows() < 1000) sh.insertRowsAfter(sh.getMaxRows(), 1000 - sh.getMaxRows());
  var col = function (nome) { return COLUNAS.indexOf(nome) + 1; };

  sh.getRange(2, col('Data'), linhas, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  sh.getRange(2, col('Data do próximo passo'), linhas, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, col('WhatsApp'), linhas, 1).setNumberFormat('@');

  var lista = function (valores, estrito) {
    return SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(!estrito).build();
  };
  sh.getRange(2, col('Status'), linhas, 1).setDataValidation(lista(STATUS, true));
  sh.getRange(2, col('Origem'), linhas, 1).setDataValidation(lista(ORIGENS, false));
  sh.getRange(2, col('Tipo'), linhas, 1).setDataValidation(lista(TIPOS, false));
  sh.getRange(2, col('Data do próximo passo'), linhas, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());

  // Cores por status (linha inteira) e destaque de próximo passo vencido.
  var tudo = sh.getRange(2, 1, linhas, n);
  var regras = STATUS.map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$B2="' + s + '"').setBackground(CORES_STATUS[s]).setRanges([tudo]).build();
  });
  var colPasso = String.fromCharCode(64 + col('Data do próximo passo'));
  regras.unshift(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($' + colPasso + '2<>"",$' + colPasso + '2<TODAY(),$B2<>"Fechado",$B2<>"Perdido")')
    .setBackground('#FAD4D4').setFontColor('#8A1C1C').setRanges([sh.getRange(2, col('Data do próximo passo'), linhas, 1)]).build());
  sh.setConditionalFormatRules(regras);

  if (!sh.getFilter()) sh.getRange(1, 1, sh.getMaxRows(), n).createFilter();
  sh.getRange(2, 1, linhas, n).setVerticalAlignment('top').setWrap(false);
  sh.getRange(2, col('Mensagem'), linhas, 1).setWrap(true);
  sh.getRange(2, col('Notas'), linhas, 1).setWrap(true);

  montarPainel_(ss);
  ss.setActiveSheet(sh);
  SpreadsheetApp.getUi().alert('Pronto! A planilha está montada. Agora faça a implantação como App da Web (passo 4 no topo do script).');
}

function montarPainel_(ss) {
  var p = ss.getSheetByName(ABA_PAINEL) || ss.insertSheet(ABA_PAINEL);
  p.clear();
  p.setHiddenGridlines(true);
  p.setColumnWidth(1, 220); p.setColumnWidth(2, 110); p.setColumnWidth(3, 40); p.setColumnWidth(4, 200); p.setColumnWidth(5, 110);
  p.getRange('A1').setValue('CEBEL · Painel de leads').setFontSize(18).setFontWeight('bold').setFontColor('#0A459F');
  p.getRange('A2').setFormula('="Atualizado em "&TEXT(NOW(),"dd/MM/yyyy HH:mm")').setFontColor('#4C5B73');

  var cab = function (r) { return p.getRange(r).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0A459F'); };

  p.getRange('A4:B4').setValues([['Resumo', '']]); cab('A4:B4');
  p.getRange('A5:A9').setValues([['Leads no total'], ['Últimos 7 dias'], ['Últimos 30 dias'], ['Em aberto'], ['Fechados']]);
  p.getRange('B5').setFormula('=COUNTA(Leads!C2:C)');
  p.getRange('B6').setFormula('=COUNTIFS(Leads!A2:A,">="&(TODAY()-7))');
  p.getRange('B7').setFormula('=COUNTIFS(Leads!A2:A,">="&(TODAY()-30))');
  p.getRange('B8').setFormula('=COUNTA(Leads!C2:C)-COUNTIF(Leads!B2:B,"Fechado")-COUNTIF(Leads!B2:B,"Perdido")');
  p.getRange('B9').setFormula('=COUNTIF(Leads!B2:B,"Fechado")');

  p.getRange('A11:B11').setValues([['Por status', 'Leads']]); cab('A11:B11');
  STATUS.forEach(function (s, i) {
    p.getRange(12 + i, 1).setValue(s).setBackground(CORES_STATUS[s]);
    p.getRange(12 + i, 2).setFormula('=COUNTIF(Leads!B2:B,A' + (12 + i) + ')');
  });

  p.getRange('D4:E4').setValues([['Por origem', 'Leads']]); cab('D4:E4');
  p.getRange('D5').setFormula('=IFERROR(QUERY(Leads!L2:L,"select L, count(L) where L is not null group by L order by count(L) desc label count(L) \'\'",0),"Nenhum lead ainda")');

  p.getRange('A5:B20').setFontSize(11);
  p.getRange('B5:B9').setFontWeight('bold').setHorizontalAlignment('right');
}

/** Recebe os formulários do site. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (TOKEN && d.token !== TOKEN) return resposta_({ ok: false, erro: 'token' });

    var c = d.campos || {};
    var tel = String(c['WhatsApp'] || '').trim();
    var digitos = tel.replace(/\D/g, '');
    if (digitos && digitos.length <= 11) digitos = '55' + digitos;

    var linha = {};
    linha['Data'] = new Date();
    linha['Status'] = 'Novo';
    linha['Nome'] = c['Nome'] || '';
    linha['WhatsApp'] = tel;
    linha['Abrir conversa'] = digitos ? '=HYPERLINK("https://wa.me/' + digitos + '","Abrir")' : '';
    linha['Negócio'] = c['Negócio'] || '';
    linha['Tipo'] = c['Tipo'] || '';
    linha['Cidade / bairro'] = c['Local'] || '';
    linha['Vagas'] = c['Vagas'] || '';
    linha['Assunto'] = c['Assunto'] || (d.formulario === 'parceiro' ? 'Quero um eletroposto no meu negócio' : '');
    linha['Mensagem'] = c['Mensagem'] || c['Obs.'] || '';
    linha['Origem'] = d.origem || 'site';
    linha['Campanha'] = [d.meio, d.campanha].filter(String).join(' · ');
    linha['Formulário'] = d.formulario || '';
    linha['Notas'] = d.pagina ? 'Enviado em ' + d.pagina : '';

    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_LEADS);
    var valores = COLUNAS.map(function (k) { return linha[k] !== undefined ? linha[k] : ''; });
    var proxima = primeiraLinhaVazia_(sh);
    sh.getRange(proxima, 1, 1, valores.length).setValues([valores]);

    if (AVISAR_POR_EMAIL) {
      try {
        var corpo = [
          'Novo lead pelo site da CEBEL', '',
          'Nome: ' + linha['Nome'], 'WhatsApp: ' + tel, 'Negócio: ' + linha['Negócio'], 'Tipo: ' + linha['Tipo'],
          'Local: ' + linha['Cidade / bairro'], 'Vagas: ' + linha['Vagas'], 'Assunto: ' + linha['Assunto'],
          'Mensagem: ' + linha['Mensagem'], 'Origem: ' + linha['Origem'] + (linha['Campanha'] ? ' (' + linha['Campanha'] + ')' : ''), '',
          digitos ? 'Responder: https://wa.me/' + digitos : '',
          'Planilha: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
        ].join('\n');
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
          'Novo lead CEBEL: ' + (linha['Negócio'] || linha['Nome'] || 'site'), corpo);
      } catch (x) {}
    }
    return resposta_({ ok: true });
  } catch (err) {
    return resposta_({ ok: false, erro: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/** Abrir a URL do app no navegador mostra se está funcionando. */
function doGet() {
  return resposta_({ ok: true, servico: 'CEBEL leads' });
}

/** Simula um envio do site para testar a planilha (rode pelo editor). */
function testarEnvio() {
  doPost({ postData: { contents: JSON.stringify({
    token: TOKEN, formulario: 'parceiro', pagina: '/parceiros/', origem: 'teste', meio: '', campanha: '',
    campos: { 'Nome': 'Teste CEBEL', 'WhatsApp': '(21) 99999-0000', 'Negócio': 'Lead de teste (pode apagar)',
      'Tipo': 'Academia', 'Local': 'Itaguaí, Centro', 'Vagas': '21 a 50', 'Obs.': 'Linha criada pelo testarEnvio' }
  }) } });
  SpreadsheetApp.getUi().alert('Lead de teste adicionado na aba Leads. Pode apagar a linha depois.');
}

function primeiraLinhaVazia_(sh) {
  var nomes = sh.getRange(2, COLUNAS.indexOf('Nome') + 1, sh.getMaxRows() - 1, 1).getValues();
  var datas = sh.getRange(2, 1, sh.getMaxRows() - 1, 1).getValues();
  for (var i = 0; i < nomes.length; i++) if (nomes[i][0] === '' && datas[i][0] === '') return i + 2;
  sh.insertRowsAfter(sh.getMaxRows(), 100);
  return nomes.length + 2;
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
