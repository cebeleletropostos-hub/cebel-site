# Gera as páginas em inglês (/en/) e espanhol (/es/) a partir das páginas em português.
# Uso: python3 tools/traduzir.py   (rodar na raiz do repositório depois de mudar textos em PT)
# Cada página tem uma lista de trechos (pt, en, es). Se um trecho PT não for encontrado, o script avisa.
import re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

PATHS = {
 'home':        ('/',             '/en/',               '/es/'),
 'estacoes':    ('/estacoes/',    '/en/stations/',      '/es/estaciones/'),
 'motoristas':  ('/motoristas/',  '/en/how-to-charge/', '/es/como-cargar/'),
 'parceiros':   ('/parceiros/',   '/en/partners/',      '/es/anfitriones/'),
 'sobre':       ('/sobre/',       '/en/about/',         '/es/sobre/'),
 'contato':     ('/contato/',     '/en/contact/',       '/es/contacto/'),
 'privacidade': ('/privacidade/', '/en/privacy/',      '/es/privacidad/'),
}
FILES = {'home':'index.html','estacoes':'estacoes/index.html','motoristas':'motoristas/index.html','parceiros':'parceiros/index.html',
         'sobre':'sobre/index.html','contato':'contato/index.html','privacidade':'privacidade/index.html'}

COMMON = [
 ('Recarga de carros elétricos · Estado do RJ','EV charging · Rio de Janeiro State','Carga de autos eléctricos · Estado de Río de Janeiro'),
 ('aria-label="Simulação de uma recarga em andamento"','aria-label="Simulated charging session"','aria-label="Simulación de una carga en curso"'),
 ('<span class="live">Carregando</span>','<span class="live">Charging</span>','<span class="live">Cargando</span>'),
 ('<small>por kWh · toda a rede</small>','<small>per kWh · whole network</small>','<small>por kWh · toda la red</small>'),
]

PAGES = {}

PAGES['home'] = [
 ('<p class="eyebrow">Recarga de carros elétricos · Estado do RJ</p>','<p class="eyebrow">EV charging · Rio de Janeiro State</p>','<p class="eyebrow">Carga de autos eléctricos · Estado de Río de Janeiro</p>'),
 ('Energia limpa onde você <span class="swash">já para.</span>','Clean energy where you <span class="swash">already stop.</span>','Energía limpia donde <span class="swash">ya se detiene.</span>'),
 ('A CEBEL instala e opera eletropostos em academias, shoppings e comércios do Rio de Janeiro. Você carrega enquanto treina ou faz compras.',
  'CEBEL installs and operates EV chargers at gyms, malls and businesses across Rio de Janeiro. Charge while you work out or shop.',
  'CEBEL instala y opera cargadores para autos eléctricos en gimnasios, centros comerciales y negocios de Río de Janeiro. Cargue mientras entrena o hace compras.'),
 ('Encontrar uma estação {% include','Find a station {% include','Encontrar una estación {% include'),
 ('>Tenho um estacionamento</a>','>I own a parking lot</a>','>Tengo un estacionamiento</a>'),
 ('<span>Parceira da <b>Smart Fit</b></span>','<span>Partner of <b>Smart Fit</b></span>','<span>Socia de <b>Smart Fit</b></span>'),
 ('</b> estações ativas</span>','</b> stations open</span>','</b> estaciones activas</span>'),
 ('/kWh, sem taxa de ociosidade</span>','/kWh, no idle fees</span>','/kWh, sin tarifa por inactividad</span>'),
 ('<span class="pill operando">Em operação</span>','<span class="pill operando">Open</span>','<span class="pill operando">En operación</span>'),
 ('#itaguai">Como chegar {% include','#itaguai">Get directions {% include','#itaguai">Cómo llegar {% include'),
 ('<p class="eyebrow">Rede CEBEL</p>','<p class="eyebrow">CEBEL network</p>','<p class="eyebrow">Red CEBEL</p>'),
 ('<h2 class="h-lg">Onde carregar hoje</h2>','<h2 class="h-lg">Where to charge today</h2>','<h2 class="h-lg">Dónde cargar hoy</h2>'),
 ('Endereço exato, rota pelo Google Maps ou Waze e o tipo de carregador de cada estação.','Exact address, directions via Google Maps or Waze, and the charger type at each station.','Dirección exacta, ruta por Google Maps o Waze y el tipo de cargador de cada estación.'),
 ('<p class="eyebrow">A caminho</p>','<p class="eyebrow">Coming next</p>','<p class="eyebrow">Próximamente</p>'),
 ('<p class="eyebrow">Para donos de estacionamento</p>','<p class="eyebrow">For parking lot owners</p>','<p class="eyebrow">Para dueños de estacionamientos</p>'),
 ('Seu estacionamento pode <span class="swash">gerar receita.</span>','Your parking lot can <span class="swash">earn revenue.</span>','Su estacionamiento puede <span class="swash">generar ingresos.</span>'),
 ('<b>Zero investimento.</b> Compramos, instalamos e mantemos o carregador.','<b>Zero investment.</b> We buy, install and maintain the charger.','<b>Inversión cero.</b> Compramos, instalamos y mantenemos el cargador.'),
 ('% da receita líquida</b> de cada recarga, todo mês.','% of net revenue</b> from every charge, every month.','% de los ingresos netos</b> de cada carga, todos los meses.'),
 ('<b>A energia é por nossa conta.</b> Sua conta de luz não muda.','<b>We pay for the energy.</b> Your electricity bill stays the same.','<b>La energía corre por nuestra cuenta.</b> Su factura de luz no cambia.'),
 ('<b>Clientes que ficam mais tempo</b> no seu negócio enquanto o carro carrega.','<b>Customers who stay longer</b> at your business while their car charges.','<b>Clientes que se quedan más tiempo</b> en su negocio mientras el auto carga.'),
 ('Simular meu retorno {% include','Estimate my earnings {% include','Simular mis ingresos {% include'),
 ('#contato">Pedir visita técnica</a>','#contato">Request a site visit</a>','#contato">Solicitar visita técnica</a>'),
 ('<span class="k">Exemplo · carregador rápido</span>','<span class="k">Example · fast charger</span>','<span class="k">Ejemplo · cargador rápido</span>'),
 ('<small> /mês</small>','<small> /month</small>','<small> /mes</small>'),
 ('<span>Recargas por dia</span>','<span>Charges per day</span>','<span>Cargas por día</span>'),
 ('<span>Energia por recarga</span>','<span>Energy per charge</span>','<span>Energía por carga</span>'),
 ('<span>Receita bruta no mês</span>','<span>Gross monthly revenue</span>','<span>Ingresos brutos del mes</span>'),
 ('<span>Seu investimento</span>','<span>Your investment</span>','<span>Su inversión</span>'),
 ('Estimativa ilustrativa para o local parceiro, com as premissas da nossa calculadora.','Illustrative estimate for the host, using our calculator\'s assumptions.','Estimación ilustrativa para el anfitrión, con los supuestos de nuestra calculadora.'),
 ('<p class="eyebrow">Como funciona</p>\n      <h2 class="h-lg">Um modelo em que todo mundo ganha</h2>','<p class="eyebrow">How it works</p>\n      <h2 class="h-lg">A model where everyone wins</h2>','<p class="eyebrow">Cómo funciona</p>\n      <h2 class="h-lg">Un modelo en el que todos ganan</h2>'),
 ('<span class="who">Motorista</span><h3>Carrega enquanto faz outra coisa</h3><p>Paga só a energia que usa, R$ {{ site.preco_kwh }} por kWh, sem taxa por tempo parado.</p>',
  '<span class="who">Driver</span><h3>Charges while doing something else</h3><p>Pays only for the energy used, R$ {{ site.preco_kwh }} per kWh, with no idle fees.</p>',
  '<span class="who">Conductor</span><h3>Carga mientras hace otra cosa</h3><p>Paga solo la energía que usa, R$ {{ site.preco_kwh }} por kWh, sin tarifa por tiempo detenido.</p>'),
 ('<span class="who">Local parceiro</span><h3>Ganha sem investir</h3><p>Cede a vaga e recebe parte de cada recarga, além de clientes que ficam mais tempo.</p>',
  '<span class="who">Host</span><h3>Earns without investing</h3><p>Provides the parking space and receives a share of every charge, plus customers who stay longer.</p>',
  '<span class="who">Anfitrión</span><h3>Gana sin invertir</h3><p>Cede el espacio y recibe parte de cada carga, además de clientes que se quedan más tiempo.</p>'),
 ('<h3>Cuida de tudo</h3><p>Equipamento, instalação, energia, software e manutenção. A estação funcionando é responsabilidade nossa.</p>',
  '<h3>Handles everything</h3><p>Equipment, installation, energy, software and maintenance. Keeping the station running is our job.</p>',
  '<h3>Se encarga de todo</h3><p>Equipo, instalación, energía, software y mantenimiento. Que la estación funcione es responsabilidad nuestra.</p>'),
 ('Vamos levar energia limpa para o seu negócio?','Shall we bring clean energy to your business?','¿Llevamos energía limpia a su negocio?'),
 ('Academias, shoppings, supermercados, hotéis e restaurantes de estrada no estado do Rio. A visita técnica é gratuita.','Gyms, malls, supermarkets, hotels and roadside restaurants in Rio de Janeiro state. The site visit is free.','Gimnasios, centros comerciales, supermercados, hoteles y restaurantes de carretera en el estado de Río. La visita técnica es gratuita.'),
 ('Quero ser parceiro {% include','I want to be a host {% include','Quiero ser anfitrión {% include'),
]

PAGES['estacoes'] = [
 ('titulo: Estações de recarga','titulo: Charging stations','titulo: Estaciones de carga'),
 ('descricao: Estações de recarga CEBEL para carros elétricos no Rio de Janeiro. Endereços, rotas pelo Google Maps e Waze e as novas estações a caminho.',
  'descricao: CEBEL EV charging stations in Rio de Janeiro. Addresses, directions via Google Maps and Waze, and the new stations on the way.',
  'descricao: Estaciones de carga CEBEL para autos eléctricos en Río de Janeiro. Direcciones, rutas por Google Maps y Waze y las nuevas estaciones en camino.'),
 ('<p class="eyebrow">Estações</p>','<p class="eyebrow">Stations</p>','<p class="eyebrow">Estaciones</p>'),
 ('Onde carregar com a <span class="swash">CEBEL.</span>','Where to charge with <span class="swash">CEBEL.</span>','Dónde cargar con <span class="swash">CEBEL.</span>'),
 ('Endereço exato e rota direto no Google Maps ou no Waze. Preço único de R$ {{ site.preco_kwh }} por kWh em toda a rede, sem taxa de ociosidade.',
  'Exact address and directions straight in Google Maps or Waze. One price, R$ {{ site.preco_kwh }} per kWh, across the whole network, with no idle fees.',
  'Dirección exacta y ruta directa en Google Maps o Waze. Precio único de R$ {{ site.preco_kwh }} por kWh en toda la red, sin tarifa por inactividad.'),
 ('<p class="eyebrow">Em operação</p>','<p class="eyebrow">Open now</p>','<p class="eyebrow">En operación</p>'),
 ('}} estações abertas agora</h2>','}} stations open now</h2>','}} estaciones abiertas ahora</h2>'),
 ('<p class="eyebrow">A caminho</p>','<p class="eyebrow">Coming next</p>','<p class="eyebrow">Próximamente</p>'),
 ('<h2 class="h-lg">Próximas estações</h2>','<h2 class="h-lg">Upcoming stations</h2>','<h2 class="h-lg">Próximas estaciones</h2>'),
 ('Equipamentos comprados e instalação em andamento. Os endereços entram aqui assim que cada estação abrir.','Equipment purchased and installation under way. Addresses will appear here as each station opens.','Equipos comprados e instalación en curso. Las direcciones aparecerán aquí cuando abra cada estación.'),
 ('Você paga só a energia que entrou no carro.','You pay only for the energy that went into your car.','Usted paga solo la energía que entró en su auto.'),
 ('Sem taxa por tempo conectado após a recarga.','No fee for staying plugged in after charging.','Sin tarifa por tiempo conectado después de cargar.'),
 ('Pagamento pelo aplicativo, direto no celular.','Pay through the app, right on your phone.','Pago por la aplicación, directo en el celular.'),
 ('Quer uma estação perto de você?','Want a station near you?','¿Quiere una estación cerca de usted?'),
 ('Se você é dono de um estacionamento, ou conhece um bom local, fale com a gente.','If you own a parking lot, or know a good location, get in touch.','Si tiene un estacionamiento, o conoce un buen lugar, hable con nosotros.'),
 ('Indicar um local {% include','Suggest a location {% include','Sugerir un lugar {% include'),
]

PAGES['motoristas'] = [
 ('titulo: Como carregar','titulo: How to charge','titulo: Cómo cargar'),
 ('descricao: Como carregar seu carro elétrico numa estação CEBEL. Preço, aplicativo, tipos de carregador e dúvidas frequentes.',
  'descricao: How to charge your electric car at a CEBEL station. Price, app, charger types and FAQ.',
  'descricao: Cómo cargar su auto eléctrico en una estación CEBEL. Precio, aplicación, tipos de cargador y preguntas frecuentes.'),
 ('<p class="eyebrow">Para motoristas</p>','<p class="eyebrow">For drivers</p>','<p class="eyebrow">Para conductores</p>'),
 ('Carregar é <span class="swash">simples.</span>','Charging is <span class="swash">simple.</span>','Cargar es <span class="swash">simple.</span>'),
 ('Tudo pelo celular. Você estaciona, conecta, libera a recarga no aplicativo e paga só a energia que usou.','All from your phone. Park, plug in, start the charge in the app and pay only for the energy you used.','Todo desde el celular. Estacione, conecte, inicie la carga en la aplicación y pague solo la energía que usó.'),
 ('Ver estações {% include','See stations {% include','Ver estaciones {% include'),
 ('<p class="eyebrow">Passo a passo</p>','<p class="eyebrow">Step by step</p>','<p class="eyebrow">Paso a paso</p>'),
 ('Da vaga à bateria cheia','From parking spot to full battery','Del estacionamiento a la batería llena'),
 ('<h3>Baixe o app</h3><p>Nossas estações funcionam pelo aplicativo EzVolt, para Android e iPhone. Crie sua conta e adicione créditos, a partir de R$ 20, por Pix ou cartão.</p>',
  '<h3>Download the app</h3><p>Our stations run on the EzVolt app for Android and iPhone. Create an account and add credit, from R$ 20, by Pix or card.</p>',
  '<h3>Descargue la app</h3><p>Nuestras estaciones funcionan con la aplicación EzVolt, para Android y iPhone. Cree su cuenta y agregue crédito, desde R$ 20, por Pix o tarjeta.</p>'),
 ('<h3>Estacione e conecte</h3><p>Pare na vaga sinalizada da CEBEL e encaixe o conector no seu carro.</p>',
  '<h3>Park and plug in</h3><p>Park in the marked CEBEL spot and plug the connector into your car.</p>',
  '<h3>Estacione y conecte</h3><p>Estacione en el lugar señalizado de CEBEL y conecte el cable a su auto.</p>'),
 ('<h3>Libere a recarga</h3><p>No app, escolha a estação ou leia o QR code do carregador e inicie a recarga.</p>',
  '<h3>Start charging</h3><p>In the app, choose the station or scan the charger\'s QR code and start the session.</p>',
  '<h3>Inicie la carga</h3><p>En la app, elija la estación o lea el código QR del cargador e inicie la carga.</p>'),
 ('<h3>Acompanhe e encerre</h3><p>Veja a energia entregue em tempo real. Ao terminar, encerre no app e o valor sai dos seus créditos.</p>',
  '<h3>Track and finish</h3><p>See the energy delivered in real time. When you\'re done, stop it in the app and the amount comes out of your credit.</p>',
  '<h3>Siga y finalice</h3><p>Vea la energía entregada en tiempo real. Al terminar, finalice en la app y el valor se descuenta de su crédito.</p>'),
 ('aria-label="Vídeo na estação da Smart Fit Itaguaí mostrando como carregar pelo app EzVolt"','aria-label="Video at the Smart Fit Itaguaí station showing how to charge with the EzVolt app (in Portuguese)"','aria-label="Video en la estación de Smart Fit Itaguaí que muestra cómo cargar con la app EzVolt (en portugués)"'),
 ('aria-pressed="false">Ativar som</button>','aria-pressed="false">Turn sound on</button>','aria-pressed="false">Activar sonido</button>'),
 ('<figcaption>Na prática, na nossa estação de Itaguaí</figcaption>','<figcaption>In practice, at our Itaguaí station (video in Portuguese)</figcaption>','<figcaption>En la práctica, en nuestra estación de Itaguaí (video en portugués)</figcaption>'),
 ('Um carro médio recebe de 15 a 30 kWh numa parada: algo entre R$ 30 e R$ 60.','An average car takes 15 to 30 kWh per stop: roughly R$ 30 to R$ 60.','Un auto promedio recibe de 15 a 30 kWh por parada: entre R$ 30 y R$ 60.'),
 ('Sem taxa de ociosidade. Mas libere a vaga ao terminar, para o próximo motorista.','No idle fees. But please free up the spot when you\'re done, for the next driver.','Sin tarifa por inactividad. Pero libere el lugar al terminar, para el próximo conductor.'),
 ('Créditos no app a partir de R$ 20, por Pix ou cartão. Mesmo preço em toda a rede.','App credit from R$ 20, by Pix or card. Same price across the network.','Crédito en la app desde R$ 20, por Pix o tarjeta. Mismo precio en toda la red.'),
 ('<p class="eyebrow">Tipos de carregador</p>','<p class="eyebrow">Charger types</p>','<p class="eyebrow">Tipos de cargador</p>'),
 ('<h2 class="h-lg">Rápido ou lento?</h2>','<h2 class="h-lg">Fast or slow?</h2>','<h2 class="h-lg">¿Rápido o lento?</h2>'),
 ('<h3>Recarga rápida</h3><p>De 30 minutos a 1 hora para uma boa parte da bateria. Ideal para quem está de passagem.</p>',
  '<h3>Fast charging</h3><p>30 minutes to 1 hour for a good part of the battery. Ideal if you\'re passing through.</p>',
  '<h3>Carga rápida</h3><p>De 30 minutos a 1 hora para buena parte de la batería. Ideal si está de paso.</p>'),
 ('<h3>Recarga lenta</h3><p>Algumas horas para encher. Ideal para quem fica bastante tempo, como no treino ou no trabalho.</p>',
  '<h3>Slow charging</h3><p>A few hours to fill up. Ideal when you stay a while, like at the gym or at work.</p>',
  '<h3>Carga lenta</h3><p>Algunas horas para llenar. Ideal si se queda bastante tiempo, como en el gimnasio o en el trabajo.</p>'),
 ('<span class="who">Conectores</span><h3>Padrão brasileiro</h3><p>Tipo 2 na recarga lenta e CCS2 na rápida, os padrões da maioria dos carros vendidos no Brasil.</p>',
  '<span class="who">Connectors</span><h3>Brazilian standard</h3><p>Type 2 for slow charging and CCS2 for fast charging, the standards on most cars sold in Brazil.</p>',
  '<span class="who">Conectores</span><h3>Estándar brasileño</h3><p>Tipo 2 en la carga lenta y CCS2 en la rápida, los estándares de la mayoría de los autos vendidos en Brasil.</p>'),
 ('<p class="eyebrow">Dúvidas frequentes</p>\n      <h2 class="h-lg">Perguntas de motoristas</h2>','<p class="eyebrow">FAQ</p>\n      <h2 class="h-lg">Driver questions</h2>','<p class="eyebrow">Preguntas frecuentes</p>\n      <h2 class="h-lg">Preguntas de conductores</h2>'),
 ('<summary>Preciso ser aluno da Smart Fit para carregar?</summary><p>Não. As estações são abertas a qualquer motorista, dentro do horário de funcionamento do estacionamento.</p>',
  '<summary>Do I need to be a Smart Fit member to charge?</summary><p>No. The stations are open to any driver during the parking lot\'s opening hours.</p>',
  '<summary>¿Necesito ser socio de Smart Fit para cargar?</summary><p>No. Las estaciones están abiertas a cualquier conductor, dentro del horario de funcionamiento del estacionamiento.</p>'),
 ('<summary>Meu carro é compatível?</summary><p>Carros elétricos e híbridos plug-in vendidos no Brasil usam Tipo 2 (recarga lenta) e CCS2 (recarga rápida). Confira o tipo de cada estação na página de estações.</p>',
  '<summary>Is my car compatible?</summary><p>Electric and plug-in hybrid cars sold in Brazil use Type 2 (slow charging) and CCS2 (fast charging). Check each station\'s type on the stations page.</p>',
  '<summary>¿Mi auto es compatible?</summary><p>Los autos eléctricos e híbridos enchufables vendidos en Brasil usan Tipo 2 (carga lenta) y CCS2 (carga rápida). Consulte el tipo de cada estación en la página de estaciones.</p>'),
 ('<summary>O que faço se o carregador não funcionar?</summary><p>Fale com a gente pelo WhatsApp {{ site.whatsapp_display }}, informando a estação. Nossa equipe pode reiniciar o carregador à distância na maioria dos casos.</p>',
  '<summary>What if the charger doesn\'t work?</summary><p>Message us on WhatsApp at {{ site.whatsapp_display }} and tell us which station. In most cases our team can restart the charger remotely.</p>',
  '<summary>¿Qué hago si el cargador no funciona?</summary><p>Escríbanos por WhatsApp al {{ site.whatsapp_display }}, indicando la estación. En la mayoría de los casos nuestro equipo puede reiniciar el cargador a distancia.</p>'),
 ('<summary>Posso deixar o carro na vaga depois de carregar?</summary><p>Não cobramos taxa por tempo parado, mas pedimos que você libere a vaga ao terminar, para outros motoristas também poderem carregar.</p>',
  '<summary>Can I leave my car in the spot after charging?</summary><p>We don\'t charge idle fees, but please free up the spot when you\'re done so other drivers can charge too.</p>',
  '<summary>¿Puedo dejar el auto en el lugar después de cargar?</summary><p>No cobramos tarifa por tiempo detenido, pero le pedimos que libere el lugar al terminar, para que otros conductores también puedan cargar.</p>'),
]

PAGES['parceiros'] = [
 ('titulo: Seja parceiro','titulo: Become a host','titulo: Sea anfitrión'),
 ('descricao: Tenha um eletroposto no estacionamento do seu negócio sem investir nada. A CEBEL instala, opera e paga a energia; você recebe parte da receita.',
  'descricao: Get an EV charger in your business\'s parking lot with zero investment. CEBEL installs it, runs it and pays for the energy; you get a share of the revenue.',
  'descricao: Tenga un cargador eléctrico en el estacionamiento de su negocio sin invertir nada. CEBEL lo instala, lo opera y paga la energía; usted recibe parte de los ingresos.'),
 ('<p class="eyebrow">Para donos de estacionamento no RJ</p>','<p class="eyebrow">For parking lot owners in Rio de Janeiro</p>','<p class="eyebrow">Para dueños de estacionamientos en Río de Janeiro</p>'),
 ('Um eletroposto no seu estacionamento. <span class="swash">Investimento zero.</span>','An EV charger in your parking lot. <span class="swash">Zero investment.</span>','Un cargador eléctrico en su estacionamiento. <span class="swash">Inversión cero.</span>'),
 ('Parceira da Smart Fit em Itaguaí e Rio das Ostras, a CEBEL compra, instala e opera o carregador de carro elétrico. Você cede a vaga, recebe uma parte de cada recarga e ganha clientes que ficam de 30 minutos a 1 hora no seu negócio.',
  'Partner of Smart Fit in Itaguaí and Rio das Ostras, CEBEL buys, installs and operates the EV charger. You provide the parking space, receive a share of every charge, and gain customers who spend 30 minutes to 1 hour at your business.',
  'Socia de Smart Fit en Itaguaí y Rio das Ostras, CEBEL compra, instala y opera el cargador. Usted cede el espacio, recibe parte de cada carga y gana clientes que pasan de 30 minutos a 1 hora en su negocio.'),
 ('<a class="btn sol" href="#contato">Pedir estudo gratuito {% include','<a class="btn sol" href="#contato">Request a free site study {% include','<a class="btn sol" href="#contato">Solicitar estudio gratuito {% include'),
 ('data-track="agendar_visita">Agendar visita técnica</a>','data-track="agendar_visita">Book a site visit</a>','data-track="agendar_visita">Agendar visita técnica</a>'),
 ('href="#calculadora">Simular meu retorno</a>','href="#calculadora">Estimate my earnings</a>','href="#calculadora">Simular mis ingresos</a>'),
 ('aria-label="Condições da parceria"','aria-label="Partnership terms"','aria-label="Condiciones de la alianza"'),
 ('<div><dt>Seu investimento</dt><dd>R$ 0</dd></div>','<div><dt>Your investment</dt><dd>R$ 0</dd></div>','<div><dt>Su inversión</dt><dd>R$ 0</dd></div>'),
 ('<div><dt>Conta de energia do carregador</dt><dd>Paga pela CEBEL</dd></div>','<div><dt>Charger electricity bill</dt><dd>Paid by CEBEL</dd></div>','<div><dt>Factura de energía del cargador</dt><dd>La paga CEBEL</dd></div>'),
 ('<div><dt>Sua parte da receita líquida</dt>','<div><dt>Your share of net revenue</dt>','<div><dt>Su parte de los ingresos netos</dt>'),
 ('<div><dt>Instalação e manutenção</dt><dd>Por nossa conta</dd></div>','<div><dt>Installation and maintenance</dt><dd>On us</dd></div>','<div><dt>Instalación y mantenimiento</dt><dd>Por nuestra cuenta</dd></div>'),
 ('<div><dt>Visita técnica</dt><dd>Gratuita</dd></div>','<div><dt>Site visit</dt><dd>Free</dd></div>','<div><dt>Visita técnica</dt><dd>Gratuita</dd></div>'),
 ('<p class="eyebrow">Calculadora</p>','<p class="eyebrow">Calculator</p>','<p class="eyebrow">Calculadora</p>'),
 ('Quanto um carregador rende para você','How much a charger earns for you','Cuánto le rinde un cargador'),
 ('Ajuste o tipo de carregador e o movimento esperado. Os valores são estimativas; o estudo do seu local é gratuito.','Adjust the charger type and expected traffic. Figures are estimates; the study of your site is free.','Ajuste el tipo de cargador y el movimiento esperado. Los valores son estimaciones; el estudio de su local es gratuito.'),
 ('<span class="lbl">Tipo de carregador</span>','<span class="lbl">Charger type</span>','<span class="lbl">Tipo de cargador</span>'),
 ('aria-label="Tipo de carregador"','aria-label="Charger type"','aria-label="Tipo de cargador"'),
 ('<span>Recarga lenta, 2 a 6 h. Ideal para quem fica muito tempo.</span>','<span>Slow charging, 2 to 6 h. Ideal for long stays.</span>','<span>Carga lenta, 2 a 6 h. Ideal para estadías largas.</span>'),
 ('<span>Recarga rápida, 30 a 60 min. Ideal para alto giro.</span>','<span>Fast charging, 30 to 60 min. Ideal for high turnover.</span>','<span>Carga rápida, 30 a 60 min. Ideal para alta rotación.</span>'),
 ('<label for="sessoes">Recargas por dia','<label for="sessoes">Charges per day','<label for="sessoes">Cargas por día'),
 ('Locais em avenidas e rodovias movimentadas costumam ficar entre 4 e 10.','Sites on busy avenues and highways usually see 4 to 10.','Los locales en avenidas y carreteras transitadas suelen tener entre 4 y 10.'),
 ('<label for="kwh">Energia média por recarga','<label for="kwh">Average energy per charge','<label for="kwh">Energía promedio por carga'),
 ('Um carro elétrico médio recebe de 15 a 30 kWh por parada.','An average EV takes 15 to 30 kWh per stop.','Un auto eléctrico promedio recibe de 15 a 30 kWh por parada.'),
 ('<span class="k">Sua parte por mês</span>','<span class="k">Your share per month</span>','<span class="k">Su parte por mes</span>'),
 ('<span class="k">Em 12 meses</span>','<span class="k">Over 12 months</span>','<span class="k">En 12 meses</span>'),
 ('<span>Energia vendida no mês</span>','<span>Energy sold per month</span>','<span>Energía vendida en el mes</span>'),
 ('<span>Receita bruta (R$','<span>Gross revenue (R$','<span>Ingresos brutos (R$'),
 ('<span>Motoristas no seu local por mês</span>','<span>Drivers at your site per month</span>','<span>Conductores en su local por mes</span>'),
 ('Premissas: 30 dias por mês, tarifa ao motorista de R$ {{ site.preco_kwh }}/kWh, custo de energia de R$ 0,85/kWh e 10% de impostos. Receita líquida = bruta − impostos − energia. Valores ilustrativos, sem garantia de resultado.',
  'Assumptions: 30 days per month, driver price of R$ {{ site.preco_kwh }}/kWh, energy cost of R$ 0.85/kWh and 10% taxes. Net revenue = gross − taxes − energy. Illustrative figures, not a guarantee of results.',
  'Supuestos: 30 días por mes, tarifa al conductor de R$ {{ site.preco_kwh }}/kWh, costo de energía de R$ 0,85/kWh y 10% de impuestos. Ingresos netos = brutos − impuestos − energía. Valores ilustrativos, sin garantía de resultados.'),
 ('<p class="eyebrow">Como funciona</p>\n      <h2 class="h-lg">Do primeiro contato à primeira recarga</h2>','<p class="eyebrow">How it works</p>\n      <h2 class="h-lg">From first contact to first charge</h2>','<p class="eyebrow">Cómo funciona</p>\n      <h2 class="h-lg">Del primer contacto a la primera carga</h2>'),
 ('<h3>Visita técnica</h3><p>Avaliamos as vagas, o quadro elétrico e o fluxo do local. Sem custo.</p>','<h3>Site visit</h3><p>We assess the parking spaces, the electrical panel and the site\'s traffic. Free of charge.</p>','<h3>Visita técnica</h3><p>Evaluamos los lugares, el tablero eléctrico y el flujo del local. Sin costo.</p>'),
 ('<h3>Proposta e contrato</h3><p>Definimos quantidade de carregadores, vagas e o repasse. Contrato de cessão de uso simples.</p>','<h3>Proposal and contract</h3><p>We define the number of chargers, spaces and the revenue share. A simple space-use agreement.</p>','<h3>Propuesta y contrato</h3><p>Definimos la cantidad de cargadores, lugares y el reparto. Un contrato simple de cesión de uso.</p>'),
 ('<h3>Instalação</h3><p>A CEBEL compra o equipamento e cuida da obra elétrica e da aprovação junto à concessionária.</p>','<h3>Installation</h3><p>CEBEL buys the equipment and handles the electrical work and the utility approval.</p>','<h3>Instalación</h3><p>CEBEL compra el equipo y se encarga de la obra eléctrica y de la aprobación ante la distribuidora.</p>'),
 ('<h3>Operação</h3><p>Seu local entra no app e no Google Maps. Você recebe o repasse todo mês, com relatório de uso.</p>','<h3>Operation</h3><p>Your site goes live in the app and on Google Maps. You receive your share every month, with a usage report.</p>','<h3>Operación</h3><p>Su local aparece en la app y en Google Maps. Recibe su parte todos los meses, con un informe de uso.</p>'),
 ('<p class="eyebrow">Para quem é</p>','<p class="eyebrow">Who it\'s for</p>','<p class="eyebrow">Para quién es</p>'),
 ('Lugares onde o motorista já para','Places where drivers already stop','Lugares donde el conductor ya se detiene'),
 ('Já operamos carregadores nas unidades Smart Fit de Itaguaí e Rio das Ostras, e a Smart Fit Saquarema vem em seguida.','We already operate chargers at the Smart Fit locations in Itaguaí and Rio das Ostras, with Smart Fit Saquarema coming next.','Ya operamos cargadores en las sedes de Smart Fit de Itaguaí y Rio das Ostras, y Smart Fit Saquarema viene a continuación.'),
 ('<span class="stay">Permanência: 1 a 2 h</span><h3>Academias</h3><p>O aluno treina enquanto o carro carrega. É o modelo que já roda nas nossas unidades Smart Fit.</p>','<span class="stay">Typical stay: 1 to 2 h</span><h3>Gyms</h3><p>Members work out while their car charges. It\'s the model already running at our Smart Fit locations.</p>','<span class="stay">Permanencia: 1 a 2 h</span><h3>Gimnasios</h3><p>El socio entrena mientras el auto carga. Es el modelo que ya funciona en nuestras sedes de Smart Fit.</p>'),
 ('<span class="stay">Permanência: 1 a 3 h</span><h3>Shoppings e centros comerciais</h3><p>Mais tempo no local, mais consumo nas lojas.</p>','<span class="stay">Typical stay: 1 to 3 h</span><h3>Malls and shopping centers</h3><p>More time on site, more spending in the stores.</p>','<span class="stay">Permanencia: 1 a 3 h</span><h3>Centros comerciales</h3><p>Más tiempo en el lugar, más consumo en las tiendas.</p>'),
 ('<span class="stay">Permanência: 30 a 60 min</span><h3>Supermercados e atacarejos</h3><p>A recarga cabe no tempo da compra.</p>','<span class="stay">Typical stay: 30 to 60 min</span><h3>Supermarkets and wholesale stores</h3><p>The charge fits into the shopping trip.</p>','<span class="stay">Permanencia: 30 a 60 min</span><h3>Supermercados y mayoristas</h3><p>La carga cabe en el tiempo de la compra.</p>'),
 ('<span class="stay">Permanência: a noite toda</span><h3>Hotéis e pousadas</h3><p>Hóspedes com carro elétrico escolhem onde podem carregar.</p>','<span class="stay">Typical stay: overnight</span><h3>Hotels and inns</h3><p>Guests with EVs choose where they can charge.</p>','<span class="stay">Permanencia: toda la noche</span><h3>Hoteles y posadas</h3><p>Los huéspedes con auto eléctrico eligen dónde pueden cargar.</p>'),
 ('<span class="stay">Permanência: 30 a 60 min</span><h3>Restaurantes de estrada</h3><p>Parada natural em rodovias como RJ-106 e RJ-124.</p>','<span class="stay">Typical stay: 30 to 60 min</span><h3>Roadside restaurants</h3><p>A natural stop on highways like RJ-106 and RJ-124.</p>','<span class="stay">Permanencia: 30 a 60 min</span><h3>Restaurantes de carretera</h3><p>Parada natural en carreteras como la RJ-106 y la RJ-124.</p>'),
 ('<span class="stay">Permanência: variável</span><h3>Estacionamentos e postos</h3><p>Receita nova em vagas que já existem.</p>','<span class="stay">Typical stay: varies</span><h3>Parking lots and gas stations</h3><p>New revenue from spaces that already exist.</p>','<span class="stay">Permanencia: variable</span><h3>Estacionamientos y gasolineras</h3><p>Nuevos ingresos en lugares que ya existen.</p>'),
 ('<p class="eyebrow">Dúvidas frequentes</p>\n      <h2 class="h-lg">Perguntas de quem está avaliando</h2>','<p class="eyebrow">FAQ</p>\n      <h2 class="h-lg">Questions from owners considering it</h2>','<p class="eyebrow">Preguntas frecuentes</p>\n      <h2 class="h-lg">Preguntas de quien lo está evaluando</h2>'),
 ('<summary>Eu pago alguma coisa?</summary><p>Não. Equipamento, instalação, energia consumida pelo carregador, manutenção e software ficam por conta da CEBEL.</p>','<summary>Do I pay anything?</summary><p>No. Equipment, installation, the charger\'s electricity, maintenance and software are all covered by CEBEL.</p>','<summary>¿Pago algo?</summary><p>No. El equipo, la instalación, la energía que consume el cargador, el mantenimiento y el software corren por cuenta de CEBEL.</p>'),
 ('<summary>Como recebo minha parte?</summary><p>Mensalmente, com relatório das recargas feitas no seu local. O percentual padrão é de {{ site.repasse_parceiro }}% da receita líquida e pode ser ajustado conforme o local.</p>','<summary>How do I receive my share?</summary><p>Monthly, with a report of the charges at your site. The standard share is {{ site.repasse_parceiro }}% of net revenue and can be adjusted depending on the site.</p>','<summary>¿Cómo recibo mi parte?</summary><p>Mensualmente, con un informe de las cargas hechas en su local. El porcentaje estándar es {{ site.repasse_parceiro }}% de los ingresos netos y puede ajustarse según el local.</p>'),
 ('<summary>Preciso reservar vagas só para carros elétricos?</summary><p>Recomendamos uma ou duas vagas sinalizadas ao lado do carregador. Definimos a quantidade junto com você na visita técnica.</p>','<summary>Do I need to reserve spaces for EVs only?</summary><p>We recommend one or two marked spaces next to the charger. We decide the number with you during the site visit.</p>','<summary>¿Debo reservar lugares solo para autos eléctricos?</summary><p>Recomendamos uno o dos lugares señalizados junto al cargador. Definimos la cantidad con usted en la visita técnica.</p>'),
 ('<summary>Minha rede elétrica aguenta?</summary><p>É isso que a visita técnica confirma. Quando a carga disponível é baixa, existem soluções como carregadores AC ou baterias de apoio.</p>','<summary>Can my electrical system handle it?</summary><p>That\'s what the site visit confirms. When available capacity is low, there are solutions such as AC chargers or backup batteries.</p>','<summary>¿Mi red eléctrica lo soporta?</summary><p>Eso es lo que confirma la visita técnica. Cuando la carga disponible es baja, hay soluciones como cargadores AC o baterías de apoyo.</p>'),
 ('<summary>Qual o prazo do contrato?</summary><p>Os contratos costumam ter prazo de alguns anos para cobrir o investimento no equipamento. Os termos são discutidos caso a caso.</p>','<summary>How long is the contract?</summary><p>Contracts usually run for a few years to cover the investment in equipment. Terms are discussed case by case.</p>','<summary>¿Cuál es el plazo del contrato?</summary><p>Los contratos suelen durar algunos años para cubrir la inversión en el equipo. Los términos se discuten caso por caso.</p>'),
 ('<p class="eyebrow">Fale com a CEBEL</p>','<p class="eyebrow">Talk to CEBEL</p>','<p class="eyebrow">Hable con CEBEL</p>'),
 ('Peça o estudo <span class="swash">gratuito</span> do seu local.','Request a <span class="swash">free</span> study of your site.','Solicite el estudio <span class="swash">gratuito</span> de su local.'),
 ('<b>Atendimento direto</b> com a equipe da CEBEL, pelo WhatsApp.','<b>Direct contact</b> with the CEBEL team, on WhatsApp.','<b>Atención directa</b> con el equipo de CEBEL, por WhatsApp.'),
 ('<b>Visita técnica sem custo</b> para avaliar vagas e rede elétrica.','<b>Free site visit</b> to assess the spaces and the electrical system.','<b>Visita técnica sin costo</b> para evaluar los lugares y la red eléctrica.'),
 ('<b>Proposta com números do seu local</b>, sem compromisso.','<b>A proposal with your site\'s numbers</b>, no commitment.','<b>Propuesta con los números de su local</b>, sin compromiso.'),
 ('<h3>Seus dados</h3>','<h3>Your details</h3>','<h3>Sus datos</h3>'),
 ('<p>A mensagem vai pronta para o nosso WhatsApp.</p>','<p>Your message goes straight to our WhatsApp, ready to send.</p>','<p>El mensaje llega listo a nuestro WhatsApp.</p>'),
 ('data-intro="Olá, CEBEL! Quero um estudo gratuito para instalar um eletroposto."','data-intro="Hi, CEBEL! I\'d like a free study to install an EV charger."','data-intro="¡Hola, CEBEL! Quiero un estudio gratuito para instalar un cargador eléctrico."'),
 ('<label>Seu nome<input id="f-nome" data-label="Nome"','<label>Your name<input id="f-nome" data-key="Nome" data-label="Name"','<label>Su nombre<input id="f-nome" data-key="Nome" data-label="Nombre"'),
 ('<input id="f-tel" data-label="WhatsApp"','<input id="f-tel" data-key="WhatsApp" data-label="WhatsApp"','<input id="f-tel" data-key="WhatsApp" data-label="WhatsApp"'),
 ('placeholder="(21) 9..." required></label>\n            <label>Nome do negócio<input id="f-negocio" data-label="Negócio"','placeholder="+55 21 9..." required></label>\n            <label>Business name<input id="f-negocio" data-key="Negócio" data-label="Business"','placeholder="+55 21 9..." required></label>\n            <label>Nombre del negocio<input id="f-negocio" data-key="Negócio" data-label="Negocio"'),
 ('<label>Tipo de negócio\n              <select id="f-tipo" data-label="Tipo">','<label>Type of business\n              <select id="f-tipo" data-key="Tipo" data-label="Type">','<label>Tipo de negocio\n              <select id="f-tipo" data-key="Tipo" data-label="Tipo">'),
 ('<option>Academia</option><option>Shopping ou centro comercial</option><option>Supermercado ou atacarejo</option><option>Hotel ou pousada</option><option>Restaurante</option><option>Estacionamento ou posto</option><option>Outro</option>',
  '<option>Gym</option><option>Mall or shopping center</option><option>Supermarket or wholesale store</option><option>Hotel or inn</option><option>Restaurant</option><option>Parking lot or gas station</option><option>Other</option>',
  '<option>Gimnasio</option><option>Centro comercial</option><option>Supermercado o mayorista</option><option>Hotel o posada</option><option>Restaurante</option><option>Estacionamiento o gasolinera</option><option>Otro</option>'),
 ('<label>Cidade e bairro<input id="f-cidade" data-label="Local" autocomplete="address-level2" placeholder="Ex.: Maricá, Centro"','<label>City and neighborhood<input id="f-cidade" data-key="Local" data-label="Location" autocomplete="address-level2" placeholder="E.g. Maricá, Centro"','<label>Ciudad y barrio<input id="f-cidade" data-key="Local" data-label="Ubicación" autocomplete="address-level2" placeholder="Ej.: Maricá, Centro"'),
 ('<label>Vagas de estacionamento\n              <select id="f-vagas" data-label="Vagas"><option>Até 20</option><option>21 a 50</option><option>51 a 150</option><option>Mais de 150</option></select>',
  '<label>Parking spaces\n              <select id="f-vagas" data-key="Vagas" data-label="Spaces"><option>Up to 20</option><option>21 to 50</option><option>51 to 150</option><option>More than 150</option></select>',
  '<label>Lugares de estacionamiento\n              <select id="f-vagas" data-key="Vagas" data-label="Lugares"><option>Hasta 20</option><option>21 a 50</option><option>51 a 150</option><option>Más de 150</option></select>'),
 ('<label class="full">Algo mais que devemos saber? (opcional)<textarea id="f-obs" data-label="Obs.">','<label class="full">Anything else we should know? (optional)<textarea id="f-obs" data-key="Obs." data-label="Notes">','<label class="full">¿Algo más que debamos saber? (opcional)<textarea id="f-obs" data-key="Obs." data-label="Notas">'),
 ('aria-hidden="true">Não preencha<input','aria-hidden="true">Leave blank<input','aria-hidden="true">No completar<input'),
 ('{% include wa-done.html botao="Pedir estudo gratuito" %}','{% include wa-done.html botao="Request a free site study" %}','{% include wa-done.html botao="Solicitar estudio gratuito" %}'),
]

PAGES['sobre'] = [
 ('titulo: Sobre a CEBEL','titulo: About CEBEL','titulo: Sobre CEBEL'),
 ('descricao: A CEBEL, Companhia Brasileira de Energia Limpa, constrói uma rede de eletropostos no Rio de Janeiro em parceria com academias, shoppings e comércios.',
  'descricao: CEBEL, Companhia Brasileira de Energia Limpa, is building an EV charging network in Rio de Janeiro in partnership with gyms, malls and businesses.',
  'descricao: CEBEL, Companhia Brasileira de Energia Limpa, construye una red de carga para autos eléctricos en Río de Janeiro junto a gimnasios, centros comerciales y negocios.'),
 ('<p class="eyebrow">Sobre</p>','<p class="eyebrow">About</p>','<p class="eyebrow">Nosotros</p>'),
 ('Companhia Brasileira de <span class="swash">Energia Limpa.</span>','The Brazilian <span class="swash">Clean Energy</span> Company.','La Compañía Brasileña de <span class="swash">Energía Limpia.</span>'),
 ('Somos uma empresa fluminense de mobilidade elétrica. Construímos uma rede de eletropostos e de geração de energia limpa, levando a recarga para os lugares onde as pessoas já passam o dia.',
  'We\'re an electric mobility company from Rio de Janeiro state. We build a network of EV chargers and clean energy generation, bringing charging to the places where people already spend their day.',
  'Somos una empresa de movilidad eléctrica del estado de Río de Janeiro. Construimos una red de cargadores y de generación de energía limpia, llevando la carga a los lugares donde las personas ya pasan el día.'),
 ('alt="Logo da CEBEL, Companhia Brasileira de Energia Limpa"','alt="CEBEL logo, Companhia Brasileira de Energia Limpa"','alt="Logo de CEBEL, Companhia Brasileira de Energia Limpa"'),
 ('<p class="eyebrow">Nossa história</p>','<p class="eyebrow">Our story</p>','<p class="eyebrow">Nuestra historia</p>'),
 ('<h2 class="h-lg">Recarga onde o motorista já está.</h2>','<h2 class="h-lg">Charging where drivers already are.</h2>','<h2 class="h-lg">Carga donde el conductor ya está.</h2>'),
 ('<p>A CEBEL nasceu em 2026, no Rio de Janeiro, de uma constatação simples: a frota elétrica cresce mais rápido do que a rede de recarga, principalmente fora da capital. Quem tem um carro elétrico em Itaguaí, na Região dos Lagos ou na Baixada ainda roda pensando em onde vai carregar.</p>',
  '<p>CEBEL was founded in 2026 in Rio de Janeiro from a simple observation: the electric fleet is growing faster than the charging network, especially outside the capital. EV drivers in Itaguaí, the Lakes Region or the Baixada still drive around wondering where they\'ll charge.</p>',
  '<p>CEBEL nació en 2026, en Río de Janeiro, de una constatación simple: la flota eléctrica crece más rápido que la red de carga, sobre todo fuera de la capital. Quien tiene un auto eléctrico en Itaguaí, en la Región de los Lagos o en la Baixada todavía maneja pensando dónde va a cargar.</p>'),
 ('<p>Nossa primeira estação foi instalada na <strong>Smart Fit de Itaguaí</strong>. Depois veio <strong>Rio das Ostras</strong>, e hoje a rede cresce para Irajá, Nilópolis, Araruama e Saquarema.</p>',
  '<p>Our first station was installed at <strong>Smart Fit Itaguaí</strong>. Then came <strong>Rio das Ostras</strong>, and today the network is expanding to Irajá, Nilópolis, Araruama and Saquarema.</p>',
  '<p>Nuestra primera estación se instaló en <strong>Smart Fit Itaguaí</strong>. Después vino <strong>Rio das Ostras</strong>, y hoy la red crece hacia Irajá, Nilópolis, Araruama y Saquarema.</p>'),
 ('<p>Trabalhamos num modelo de concessão: a CEBEL investe no equipamento, opera e mantém a estação, e o local parceiro recebe parte da receita. Assim o eletroposto chega a negócios que nunca investiriam num carregador sozinhos.</p>',
  '<p>We work on a concession model: CEBEL invests in the equipment, operates and maintains the station, and the host receives a share of the revenue. That\'s how chargers reach businesses that would never invest in one on their own.</p>',
  '<p>Trabajamos con un modelo de concesión: CEBEL invierte en el equipo, opera y mantiene la estación, y el anfitrión recibe parte de los ingresos. Así el cargador llega a negocios que nunca invertirían en uno por su cuenta.</p>'),
 ('<p class="eyebrow">Como trabalhamos</p>','<p class="eyebrow">How we work</p>','<p class="eyebrow">Cómo trabajamos</p>'),
 ('<h2 class="h-lg">O que a gente promete</h2>','<h2 class="h-lg">What we promise</h2>','<h2 class="h-lg">Lo que prometemos</h2>'),
 ('<span class="who">Preço</span><h3>Preço claro</h3><p>R$ {{ site.preco_kwh }} por kWh em toda a rede. Sem taxa escondida, sem cobrança por tempo parado.</p>','<span class="who">Price</span><h3>Clear pricing</h3><p>R$ {{ site.preco_kwh }} per kWh across the network. No hidden fees, no idle charges.</p>','<span class="who">Precio</span><h3>Precio claro</h3><p>R$ {{ site.preco_kwh }} por kWh en toda la red. Sin tarifas ocultas, sin cobro por tiempo detenido.</p>'),
 ('<span class="who">Operação</span><h3>Estação funcionando</h3><p>Monitoramos as recargas e acionamos a manutenção rápido quando algo para.</p>','<span class="who">Operations</span><h3>Stations that work</h3><p>We monitor charging sessions and send maintenance quickly when something stops.</p>','<span class="who">Operación</span><h3>Estaciones funcionando</h3><p>Monitoreamos las cargas y activamos el mantenimiento rápido cuando algo se detiene.</p>'),
 ('<span class="who">Parceiros</span><h3>Relação transparente</h3><p>Relatório mensal de uso e repasse para cada local parceiro.</p>','<span class="who">Hosts</span><h3>Transparent relationship</h3><p>A monthly usage and revenue-share report for every host.</p>','<span class="who">Anfitriones</span><h3>Relación transparente</h3><p>Informe mensual de uso y reparto para cada anfitrión.</p>'),
 ('<h2 class="h-lg">Vamos crescer juntos.</h2>','<h2 class="h-lg">Let\'s grow together.</h2>','<h2 class="h-lg">Crezcamos juntos.</h2>'),
 ('<p>Se o seu negócio tem estacionamento no estado do Rio, a gente quer conversar.</p>','<p>If your business has a parking lot in Rio de Janeiro state, we\'d like to talk.</p>','<p>Si su negocio tiene estacionamiento en el estado de Río, queremos conversar.</p>'),
 ('Seja parceiro {% include','Become a host {% include','Sea anfitrión {% include'),
 ('>Fale conosco</a>','>Contact us</a>','>Contáctenos</a>'),
]

PAGES['contato'] = [
 ('titulo: Contato','titulo: Contact','titulo: Contacto'),
 ('descricao: Fale com a CEBEL pelo WhatsApp. Suporte a motoristas, parcerias para instalar eletropostos e imprensa.','descricao: Contact CEBEL on WhatsApp. Driver support, partnerships to install EV chargers, and press.','descricao: Hable con CEBEL por WhatsApp. Soporte a conductores, alianzas para instalar cargadores y prensa.'),
 ('<p class="eyebrow">Contato</p>','<p class="eyebrow">Contact</p>','<p class="eyebrow">Contacto</p>'),
 ('Fale com a <span class="swash">CEBEL.</span>','Talk to <span class="swash">CEBEL.</span>','Hable con <span class="swash">CEBEL.</span>'),
 ('Atendemos pelo WhatsApp. Escolha o assunto e a mensagem vai pronta para a nossa equipe.','We answer on WhatsApp. Pick a subject and your message goes to our team ready to send. Our team replies in Portuguese, English or Spanish.','Atendemos por WhatsApp. Elija el asunto y el mensaje llega listo a nuestro equipo.'),
 ('{% include icons.html i="wa" %}Abrir conversa</a>','{% include icons.html i="wa" %}Open chat</a>','{% include icons.html i="wa" %}Abrir conversación</a>'),
 ('<span class="k">Endereço</span>','<span class="k">Address</span>','<span class="k">Dirección</span>'),
 ('<span class="k">Empresa</span>','<span class="k">Company</span>','<span class="k">Empresa</span>'),
 ('<h3>Envie sua mensagem</h3>','<h3>Send your message</h3>','<h3>Envíe su mensaje</h3>'),
 ('<p>Preencha e toque em enviar. O WhatsApp abre com tudo pronto.</p>','<p>Fill in and tap send. WhatsApp opens with everything ready.</p>','<p>Complete y toque en enviar. WhatsApp se abre con todo listo.</p>'),
 ('data-intro="Olá, CEBEL! Vim pelo site."','data-intro="Hi, CEBEL! I found you through your website."','data-intro="¡Hola, CEBEL! Los encontré por el sitio web."'),
 ('<label class="full">Assunto\n            <select id="c-assunto" data-label="Assunto">','<label class="full">Subject\n            <select id="c-assunto" data-key="Assunto" data-label="Subject">','<label class="full">Asunto\n            <select id="c-assunto" data-key="Assunto" data-label="Asunto">'),
 ('<option>Quero um eletroposto no meu negócio</option>','<option>I want an EV charger at my business</option>','<option>Quiero un cargador en mi negocio</option>'),
 ('<option>Sou motorista e preciso de ajuda</option>','<option>I\'m a driver and need help</option>','<option>Soy conductor y necesito ayuda</option>'),
 ('<option>Quero indicar um local</option>','<option>I want to suggest a location</option>','<option>Quiero sugerir un lugar</option>'),
 ('<option>Imprensa</option>','<option>Press</option>','<option>Prensa</option>'),
 ('<option>Outro</option>','<option>Other</option>','<option>Otro</option>'),
 ('<label>Seu nome<input id="c-nome" data-label="Nome"','<label>Your name<input id="c-nome" data-key="Nome" data-label="Name"','<label>Su nombre<input id="c-nome" data-key="Nome" data-label="Nombre"'),
 ('<input id="c-tel" data-label="WhatsApp" type="tel" autocomplete="tel" inputmode="tel" placeholder="(21) 9..."','<input id="c-tel" data-key="WhatsApp" data-label="WhatsApp" type="tel" autocomplete="tel" inputmode="tel" placeholder="+55 21 9..."','<input id="c-tel" data-key="WhatsApp" data-label="WhatsApp" type="tel" autocomplete="tel" inputmode="tel" placeholder="+55 21 9..."'),
 ('<label class="full">Mensagem<textarea id="c-msg" data-label="Mensagem"','<label class="full">Message<textarea id="c-msg" data-key="Mensagem" data-label="Message"','<label class="full">Mensaje<textarea id="c-msg" data-key="Mensagem" data-label="Mensaje"'),
 ('aria-hidden="true">Não preencha<input','aria-hidden="true">Leave blank<input','aria-hidden="true">No completar<input'),
]

PAGES['privacidade'] = [
 ('titulo: Política de privacidade','titulo: Privacy policy','titulo: Política de privacidad'),
 ('descricao: Como a CEBEL usa os dados enviados pelo site e os cookies de medição.','descricao: How CEBEL uses the information sent through the website and measurement cookies.','descricao: Cómo CEBEL usa los datos enviados por el sitio y las cookies de medición.'),
 ('<p class="eyebrow">Privacidade</p>','<p class="eyebrow">Privacy</p>','<p class="eyebrow">Privacidad</p>'),
 ('<h1 class="h-xl">Política de privacidade</h1>','<h1 class="h-xl">Privacy policy</h1>','<h1 class="h-xl">Política de privacidad</h1>'),
 ('Como tratamos os dados que você envia pelo site, de acordo com a Lei Geral de Proteção de Dados (LGPD).','How we handle the information you send through the website, under Brazil\'s General Data Protection Law (LGPD).','Cómo tratamos los datos que envía por el sitio, de acuerdo con la Ley General de Protección de Datos de Brasil (LGPD).'),
 ('<h2 class="h-md">Quem somos</h2>','<h2 class="h-md">Who we are</h2>','<h2 class="h-md">Quiénes somos</h2>'),
 ('("CEBEL"), empresa de recarga de veículos elétricos no estado do Rio de Janeiro. Contato: WhatsApp','("CEBEL"), an electric vehicle charging company in Rio de Janeiro state. Contact: WhatsApp','("CEBEL"), empresa de carga de vehículos eléctricos en el estado de Río de Janeiro. Contacto: WhatsApp'),
 ('<h2 class="h-md">Quais dados coletamos</h2>','<h2 class="h-md">What we collect</h2>','<h2 class="h-md">Qué datos recopilamos</h2>'),
 ('<p>Quando você preenche um formulário, coletamos o que você digitar: nome, WhatsApp, nome e tipo do negócio, cidade, número de vagas e a mensagem. Também registramos de onde veio a visita (por exemplo, um anúncio no Instagram ou uma busca no Google) e a página em que o formulário foi enviado.</p>',
  '<p>When you fill in a form, we collect what you type: name, WhatsApp number, business name and type, city, number of parking spaces and your message. We also record where the visit came from (for example, an Instagram ad or a Google search) and the page where the form was sent.</p>',
  '<p>Cuando completa un formulario, recopilamos lo que escribe: nombre, WhatsApp, nombre y tipo de negocio, ciudad, número de lugares y el mensaje. También registramos de dónde vino la visita (por ejemplo, un anuncio en Instagram o una búsqueda en Google) y la página donde se envió el formulario.</p>'),
 ('<h2 class="h-md">Para que usamos</h2>','<h2 class="h-md">How we use it</h2>','<h2 class="h-md">Para qué los usamos</h2>'),
 ('<p>Usamos esses dados apenas para responder ao seu contato, preparar propostas de parceria e entender quais canais trazem contatos ao site. Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing.</p>',
  '<p>We use this information only to reply to you, prepare partnership proposals and understand which channels bring contacts to the site. We don\'t sell or share your data with third parties for marketing.</p>',
  '<p>Usamos estos datos solo para responder a su contacto, preparar propuestas de alianza y entender qué canales traen contactos al sitio. No vendemos ni compartimos sus datos con terceros con fines de marketing.</p>'),
 ('<h2 class="h-md">Cookies de medição</h2>','<h2 class="h-md">Measurement cookies</h2>','<h2 class="h-md">Cookies de medición</h2>'),
 ('<p>Se você aceitar no aviso de cookies, o site carrega ferramentas de medição do Google e da Meta (Facebook e Instagram) para contar visitas e contatos vindos dos nossos anúncios. Se você recusar, essas ferramentas não são carregadas. Para mudar sua escolha, limpe os dados deste site no seu navegador.</p>',
  '<p>If you accept in the cookie notice, the site loads measurement tools from Google and Meta (Facebook and Instagram) to count visits and contacts coming from our ads. If you decline, these tools are not loaded. To change your choice, clear this site\'s data in your browser.</p>',
  '<p>Si acepta en el aviso de cookies, el sitio carga herramientas de medición de Google y Meta (Facebook e Instagram) para contar visitas y contactos que vienen de nuestros anuncios. Si rechaza, estas herramientas no se cargan. Para cambiar su elección, borre los datos de este sitio en su navegador.</p>'),
 ('<h2 class="h-md">Por quanto tempo guardamos</h2>','<h2 class="h-md">How long we keep it</h2>','<h2 class="h-md">Por cuánto tiempo los guardamos</h2>'),
 ('<p>Guardamos os dados de contato enquanto houver conversa ou parceria em andamento, ou até que você peça a exclusão.</p>','<p>We keep contact details while a conversation or partnership is ongoing, or until you ask us to delete them.</p>','<p>Guardamos los datos de contacto mientras haya una conversación o alianza en curso, o hasta que pida su eliminación.</p>'),
 ('<h2 class="h-md">Seus direitos</h2>','<h2 class="h-md">Your rights</h2>','<h2 class="h-md">Sus derechos</h2>'),
 ('<p>Você pode pedir a qualquer momento acesso, correção ou exclusão dos seus dados pelo WhatsApp','<p>You can ask at any time to access, correct or delete your data via WhatsApp','<p>Puede pedir en cualquier momento el acceso, la corrección o la eliminación de sus datos por WhatsApp'),
]

# Palavras em português que não devem sobrar nas páginas traduzidas (verificação)
CHECK = ['Estação','estação','recarga','Recarga','motorista','Motorista','parceiro','Parceiro','Você','você','vagas','Saiba','Simular','Pedir','Seu ','Sua ','Quero','Também','não ','Não ']

def set_front(src, ref, lang, permalink):
    m = re.match(r'---\n(.*?)\n---\n', src, re.S)
    fm = m.group(1) if m else ''
    body = src[m.end():] if m else src
    lines = [l for l in fm.split('\n') if l and not l.startswith(('lang:','ref:','permalink:'))]
    lines += ['lang: ' + lang, 'ref: ' + ref]
    if permalink: lines.append('permalink: ' + permalink)
    return '---\n' + '\n'.join(lines) + '\n---\n' + body

def main():
    problems = 0
    for ref, f in FILES.items():
        pt = open(f, encoding='utf-8').read()
        pt2 = set_front(pt, ref, 'pt', None)
        if pt2 != pt: open(f, 'w', encoding='utf-8').write(pt2)
        for i, lang in ((1, 'en'), (2, 'es')):
            s = set_front(pt2, ref, lang, PATHS[ref][i])
            for pair in PAGES.get(ref, []) :
                if pair[0] not in s:
                    print(f'[{lang}] {ref}: trecho não encontrado: {pair[0][:70]}'); problems += 1
                s = s.replace(pair[0], pair[i])
            for r, ps in PATHS.items():
                s = s.replace("{{ '%s' | relative_url }}" % ps[0], "{{ '%s' | relative_url }}" % ps[i])
            body = s.split('---\n', 2)[2]
            visible = re.sub(r'\{[{%].*?[}%]\}', '', re.sub(r'<[^>]+>', ' ', body))
            for w in CHECK:
                if w in visible:
                    ctx = visible[max(0, visible.find(w)-40): visible.find(w)+40].replace('\n', ' ')
                    print(f'[{lang}] {ref}: possível texto em PT: "{w}" … {ctx.strip()}'); problems += 1
            out = PATHS[ref][i].strip('/') + '/index.html'
            os.makedirs(os.path.dirname(out), exist_ok=True)
            open(out, 'w', encoding='utf-8').write(s)
    print('problemas:', problems)

if __name__ == '__main__':
    main()
