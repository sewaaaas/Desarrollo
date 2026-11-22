const C={ink:'#182B3A',muted:'#58666F',accent:'#A82D45',paper:'#FBFAF7',soft:'#F0EDE7',white:'#FFFFFF'};
function tx(s,text,x,y,w,h,size=24,bold=false,color=C.ink){
 const a=s.shapes.add({geometry:'textbox',name:text.slice(0,45),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=text;a.text.style={typeface:'Aptos',fontSize:size,bold,color,insets:0,verticalAlignment:'top',autoFit:'none',wrap:'square'};return a;
}
function base(p,i,title,section,source){
 const s=p.slides.getItem(i);for(const a of [...s.shapes.items])a.delete();for(const a of [...s.images.items])a.delete();for(const a of [...s.charts.items])a.delete();for(const a of [...s.tables.items])a.delete();
 s.background.fill=C.paper;
 tx(s,section.toUpperCase(),60,35,1020,25,16,true,C.accent);
 tx(s,String(i+1).padStart(2,'0')+' / 05',1110,35,110,25,16,false,C.muted);
 tx(s,title,60,80,1160,70,44,true);
 tx(s,source,60,647,1160,22,13,false,C.muted);
 tx(s,'UPN  ·  Valor del Dinero y Operaciones Financieras',60,683,940,22,14,false,C.muted);
 tx(s,'20.11.2026',1110,683,110,22,14,false,C.muted);
 return s;
}
function note(s,body,urls){s.speakerNotes.text=body+'\n\nFuentes citadas en la presentación original:\n'+urls.join('\n');}
const product='https://cajaica.pe/personas/creditos/credito-personal-directo/';
const rates='https://cajaica.pe/media/Tarifario-Creditos-Consumo-03-11-2026.pdf';
const fees='https://cajaica.pe/media/TARIFARIO-DE-GASTOS-DE-OPERACIONES-ACTIVAS-V5.pdf';
export async function redesign({presentation,input}){
 for(const i of input.slides){
 if(i===0){
 const s=base(presentation,i,'Caja Ica: trayectoria y alcance','Contexto institucional','Fuentes: Caja Ica, historia institucional y cierre de 2025.');
 tx(s,'Desde 1989, atiende necesidades de ahorro y crédito.',60,157,1100,40,25,false,C.muted);
 tx(s,'1989',60,227,350,76,62,true,C.accent);tx(s,'Inicio de operaciones',60,308,350,30,23,true);
 tx(s,'21 de octubre, en Ica.',60,350,345,45,23,false,C.muted);
 tx(s,'1998',455,227,350,76,62,true,C.accent);tx(s,'Expansión a Cañete',455,308,350,30,23,true);
 tx(s,'Abre una nueva agencia.',455,350,345,45,23,false,C.muted);
 tx(s,'2025',850,227,350,76,62,true,C.accent);tx(s,'94 puntos de atención',850,308,370,30,23,true);
 tx(s,'11 regiones y más de\n340 mil clientes.',850,350,350,65,23,false,C.muted);
 tx(s,'Público al que atiende',60,459,1060,40,28,true);
 tx(s,'Micro y pequeños\nempresarios',60,523,350,72,25);
 tx(s,'Personas que ahorran\no solicitan crédito',455,523,350,72,25);
 tx(s,'Trabajadores con\ningresos sustentados',850,523,350,72,25);
 note(s,'Caja Ica inicia operaciones el 21 de octubre de 1989. En 1998 abre una agencia en Cañete. Los datos de cobertura y clientes corresponden al cierre de 2025.', ['https://cajaica.pe/institucional/nosotros/','https://cajaica.pe/caja-ica-nuevo-sponsor-oficial-de-los-chankas/']);
 }
 if(i===1){
 const s=base(presentation,i,'Crédito personal para una compra familiar','Producto y necesidad','Fuente: Caja Ica, Crédito Personal Directo. Acceso sujeto a evaluación.');
 tx(s,'Comprar una refrigeradora',60,179,550,45,31,true);
 tx(s,'El bien se usará en el hogar y no generará ingresos. El caso corresponde a un crédito de consumo.',60,242,520,115,27,false,C.muted);
 tx(s,'S/ 3,500',60,399,500,75,60,true,C.accent);
 tx(s,'a 12 meses',60,480,480,40,31,true);
 tx(s,'Compromiso: devolver el capital\ny pagar los cargos del crédito.',60,553,530,62,22,false,C.muted);
 tx(s,'Crédito Personal Directo',680,179,540,45,31,true);
 const rows=[['01','DNI, recibo de servicios\ny boletas de pago.'],['02','Continuidad laboral mínima\nde 6 meses.'],['03','Calificación normal en los últimos\n6 meses para clientes nuevos.'],['04','Sustento de vivienda y fiador,\nsegún el caso.']];
 rows.forEach((r,j)=>{tx(s,r[0],680,245+j*78,45,30,19,true,C.accent);tx(s,r[1],740,239+j*78,480,66,23);});
 tx(s,'Oferta publicada: hasta S/ 100,000 y 48 meses.',680,581,540,38,20,false,C.muted);
 note(s,'La refrigeradora satisface una necesidad familiar. El caso analiza S/ 3,500 a 12 meses, aunque el producto publica montos y plazos máximos mayores. La aprobación depende de evaluación. El uso doméstico justifica estudiar un crédito de consumo en lugar de capital de trabajo.',[product]);
 }
 if(i===2){
 const s=base(presentation,i,'Condiciones y cálculo de la cuota','Simulación académica','Fuentes: tarifario de consumo citado al 01/11/2026 y tarifario de gastos v005.');
 tx(s,'Tasa mínima del caso. La oferta aprobada puede ser mayor.',60,151,1160,36,24,false,C.muted);
 const vals=[['S/ 3,500','Capital'],['12 meses','Plazo'],['21.00%','TEA del caso'],['1.60%','TEM equivalente']];
 vals.forEach((v,j)=>{tx(s,v[0],60+300*j,220,280,60,44,true,j===2?C.accent:C.ink);tx(s,v[1],60+300*j,284,280,36,22,false,C.muted);});
 tx(s,'Método de cálculo',60,363,560,40,29,true);
 tx(s,'TEM = (1 + TEA)^(1/12) − 1',60,422,570,40,26);
 tx(s,'Sistema francés: cuota base fija',60,469,570,36,24);
 tx(s,'Desgravamen = saldo × 0.1097%\npara períodos de 30 días',60,513,570,70,24);
 tx(s,'S/ 322.91 + desgravamen',60,597,570,37,27,true,C.accent);
 tx(s,'Costo efectivo del caso',700,363,520,40,29,true);
 tx(s,'22.58%',700,412,480,73,58,true,C.accent);
 tx(s,'TCEA estimada, no oficial',700,483,520,34,22,false,C.muted);
 tx(s,'TEA publicada para crédito con seguro: 21%–110%.\nSeguro de la primera cuota: S/ 3.84.',700,533,520,67,21);
 tx(s,'Sin envío físico. No incluye ITF ni cargos adicionales.',700,610,520,28,16,false,C.muted);
 note(s,'Simulación académica, no es cotización aprobada. El caso usa la TEA mínima de 21% del crédito con seguro y calcula por separado el seguro de desgravamen. El tarifario citado muestra un rango de 21%–110%. La tasa final depende de la evaluación. El cálculo supone períodos de 30 días, sin envío físico solicitado. ITF y cargos adicionales no modelados. La TCEA estimada del caso es 22.58%.',[rates,fees]);
 }
 if(i===3){
 const s=base(presentation,i,'Cronograma de pagos: 12 meses','Sistema francés','Fuente: cálculo del caso con los tarifarios citados. Valores en soles.');
 tx(s,'El interés disminuye y cada cuota amortiza más capital.',60,151,1160,35,24,false,C.muted);
 const data=[['Mes','Saldo inicial','Interés','Amortización','Seguro','Cuota total','Saldo final'],['1','3500.00','56.04','266.86','3.84','326.75','3233.14'],['2','3233.14','51.77','271.14','3.55','326.45','2962.00'],['3','2962.00','47.43','275.48','3.25','326.16','2686.52'],['4','2686.52','43.02','279.89','2.95','325.85','2406.63'],['5','2406.63','38.53','284.37','2.64','325.55','2122.26'],['6','2122.26','33.98','288.92','2.33','325.23','1833.33'],['7','1833.33','29.36','293.55','2.01','324.92','1539.78'],['8','1539.78','24.65','298.25','1.69','324.60','1241.53'],['9','1241.53','19.88','303.03','1.36','324.27','938.50'],['10','938.50','15.03','307.88','1.03','323.94','630.63'],['11','630.63','10.10','312.81','0.69','323.60','317.82'],['12','317.82','5.09','317.82','0.35','323.25','0.00'],['Total','—','374.87','3500.00','25.68','3900.56','0.00']];
 const tb=s.tables.add({rows:14,columns:7,left:60,top:208,width:850,height:394,columnWidths:[63,142,110,155,100,140,140],values:data});
 tb.borders.assign({fill:'none',width:0});
 for(let r=0;r<14;r++){tb.rows[r].height=r===0?36:r===13?34:27;for(let c=0;c<7;c++){const cell=tb.getCell(r,c);cell.fill=r===0?C.ink:r===13?'#E8E2DA':r%2?C.paper:C.soft;cell.text.style={typeface:'Aptos',fontSize:r===0?16:18,color:r===0?C.white:c===5?C.accent:C.ink,bold:r===0||r===13||c===5,alignment:c===0?'center':'right',verticalAlignment:'middle',insets:{left:7,right:7,top:2,bottom:2}};}}
 tx(s,'Cuota base',950,211,270,34,27,true);tx(s,'Capital e interés',950,250,270,30,20,false,C.muted);
 s.charts.add('bar',{position:{left:940,top:295,width:290,height:250},categories:Array.from({length:12},(_,j)=>String(j+1)),series:[{name:'Capital',values:data.slice(1,13).map(r=>+r[3]),fill:'#304B60'},{name:'Interés',values:data.slice(1,13).map(r=>+r[2]),fill:C.accent}],barOptions:{direction:'column',grouping:'stacked',gapWidth:55,overlap:100},hasLegend:true,legend:{position:'bottom',textStyle:{typeface:'Aptos',fontSize:15,fill:C.muted}},xAxis:{textStyle:{typeface:'Aptos',fontSize:12,fill:C.muted},line:{fill:'none'},majorGridlines:null},yAxis:{visible:false,min:0,max:350,majorGridlines:null},chartFill:C.paper,plotAreaFill:C.paper,chartLine:{fill:'none'},plotAreaLine:{fill:'none'}});
 tx(s,'S/ 400.56',950,556,270,46,35,true,C.accent);tx(s,'Costo sobre el capital',950,602,270,30,20,false,C.muted);
 tx(s,'Intereses: S/ 374.87. Seguro: S/ 25.68. Diferencia de S/ 0.01 por redondeo.',60,611,850,29,17,false,C.muted);
 note(s,'El cronograma conserva los valores de la presentación original. La cuota base permanece alrededor de S/ 322.91 y el pago total varía por el desgravamen sobre saldo. Los totales del modelo pueden diferir de la suma de cifras mostradas por redondeo. Costo total adicional al capital: S/ 400.56. El gráfico muestra la composición de la cuota base, sin seguro.',[rates,fees,'https://cajaica.pe/atencion-al-usuario/transparencia-financiera/']);
 }
 if(i===4){
 const s=base(presentation,i,'Costo del crédito y decisión final','Análisis del caso','Fuentes: producto y tarifarios de Caja Ica. Cálculos de la simulación académica.');
 const vals=[['S/ 3,900.56','Pago total estimado'],['S/ 400.56','Costo adicional al capital'],['22.58%','TCEA estimada, no oficial']];
 vals.forEach((v,j)=>{tx(s,v[0],60+395*j,185,380,67,48,true,j===1?C.accent:C.ink);tx(s,v[1],60+395*j,257,380,35,22,false,C.muted);});
 tx(s,'Ventajas',60,341,550,40,29,true);
 tx(s,'Permite comprar sin pagar todo al inicio.\nLa cuota base es predecible.\nEl producto publica pagos adelantados sin costo.',60,401,540,140,23);
 tx(s,'Aspectos por evaluar',680,341,540,40,29,true);
 tx(s,'El costo supera el precio al contado.\nLa tasa aprobada puede ser mayor al 21%.\nLos cargos y días reales pueden variar las cuotas.',680,401,540,140,23);
 tx(s,'Conclusión',60,554,180,35,23,true,C.accent);
 tx(s,'Financiar si la compra es necesaria y la cuota cabe en el presupuesto.\nComparar ofertas y solicitar el cronograma oficial antes de aceptar.',255,551,965,74,25,true);
 note(s,'La conveniencia depende de la urgencia de compra, la liquidez del hogar y la oferta que apruebe Caja Ica. Los importes pertenecen a una simulación académica. El archivo original hace referencia a un Excel adjunto, que no forma parte de los archivos recibidos.',[product,rates,fees]);
 }
 }
 return {slidesEdited:input.slides,slideCount:presentation.slides.items.length};
}
