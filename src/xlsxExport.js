const encoder = new TextEncoder();

function limpiarXml(valor = '') {
  return String(valor)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnaExcel(indice) {
  let numero = indice + 1;
  let resultado = '';
  while (numero > 0) {
    const resto = (numero - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    numero = Math.floor((numero - 1) / 26);
  }
  return resultado;
}

function celdaXml(valor, fila, columna, estilo = 0) {
  const referencia = `${columnaExcel(columna)}${fila}`;
  if (valor === null || valor === undefined || valor === '') {
    return `<c r="${referencia}" s="${estilo}"/>`;
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${referencia}" s="${estilo}" t="n"><v>${valor}</v></c>`;
  }
  if (typeof valor === 'boolean') {
    return `<c r="${referencia}" s="${estilo}" t="b"><v>${valor ? 1 : 0}</v></c>`;
  }
  return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${limpiarXml(valor)}</t></is></c>`;
}

function hojaXml(hoja = {}) {
  const encabezados = Array.isArray(hoja.encabezados) ? hoja.encabezados : [];
  const filas = Array.isArray(hoja.filas) ? hoja.filas : [];
  const anchos = Array.isArray(hoja.anchos) ? hoja.anchos : [];
  const columnasMoneda = new Set(hoja.columnasMoneda || []);
  const columnasEntero = new Set(hoja.columnasEntero || []);
  const totalColumnas = Math.max(encabezados.length, ...filas.map(fila => fila.length), 1);
  const totalFilas = Math.max(filas.length + 1, 1);
  const dimension = `A1:${columnaExcel(totalColumnas - 1)}${totalFilas}`;

  const columnas = Array.from({ length: totalColumnas }, (_, indice) => {
    const ancho = Math.max(8, Math.min(42, Number(anchos[indice]) || 16));
    return `<col min="${indice + 1}" max="${indice + 1}" width="${ancho}" customWidth="1"/>`;
  }).join('');

  const filaEncabezados = `<row r="1" ht="24" customHeight="1">${encabezados.map((valor, indice) => celdaXml(valor, 1, indice, 1)).join('')}</row>`;
  const filasXml = filas.map((fila, indiceFila) => {
    const numeroFila = indiceFila + 2;
    const celdas = Array.from({ length: totalColumnas }, (_, indiceColumna) => {
      const estilo = columnasMoneda.has(indiceColumna) ? 2 : columnasEntero.has(indiceColumna) ? 3 : 0;
      return celdaXml(fila[indiceColumna], numeroFila, indiceColumna, estilo);
    }).join('');
    return `<row r="${numeroFila}">${celdas}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnas}</cols>
  <sheetData>${filaEncabezados}${filasXml}</sheetData>
  <autoFilter ref="${dimension}"/>
</worksheet>`;
}

function estilosXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0"/></numFmts>
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B5CAB"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD7E0EA"/></left><right style="thin"><color rgb="FFD7E0EA"/></right><top style="thin"><color rgb="FFD7E0EA"/></top><bottom style="thin"><color rgb="FFD7E0EA"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function nombreHojaSeguro(nombre = 'Hoja') {
  return String(nombre || 'Hoja').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function escribir16(buffer, offset, valor) {
  buffer[offset] = valor & 0xFF;
  buffer[offset + 1] = (valor >>> 8) & 0xFF;
}

function escribir32(buffer, offset, valor) {
  buffer[offset] = valor & 0xFF;
  buffer[offset + 1] = (valor >>> 8) & 0xFF;
  buffer[offset + 2] = (valor >>> 16) & 0xFF;
  buffer[offset + 3] = (valor >>> 24) & 0xFF;
}

function fechaDos(fecha = new Date()) {
  const year = Math.max(1980, fecha.getFullYear());
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2);
  const dia = ((year - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  return { hora, dia };
}

function crearZipArchivos(archivos = []) {
  const locales = [];
  const centrales = [];
  let offset = 0;
  const ahora = fechaDos(new Date());

  for (const archivo of archivos) {
    const nombre = encoder.encode(archivo.nombre);
    const datos = typeof archivo.contenido === 'string' ? encoder.encode(archivo.contenido) : archivo.contenido;
    const checksum = crc32(datos);
    const local = new Uint8Array(30 + nombre.length + datos.length);
    escribir32(local, 0, 0x04034B50);
    escribir16(local, 4, 20);
    escribir16(local, 6, 0x0800);
    escribir16(local, 8, 0);
    escribir16(local, 10, ahora.hora);
    escribir16(local, 12, ahora.dia);
    escribir32(local, 14, checksum);
    escribir32(local, 18, datos.length);
    escribir32(local, 22, datos.length);
    escribir16(local, 26, nombre.length);
    escribir16(local, 28, 0);
    local.set(nombre, 30);
    local.set(datos, 30 + nombre.length);
    locales.push(local);

    const central = new Uint8Array(46 + nombre.length);
    escribir32(central, 0, 0x02014B50);
    escribir16(central, 4, 20);
    escribir16(central, 6, 20);
    escribir16(central, 8, 0x0800);
    escribir16(central, 10, 0);
    escribir16(central, 12, ahora.hora);
    escribir16(central, 14, ahora.dia);
    escribir32(central, 16, checksum);
    escribir32(central, 20, datos.length);
    escribir32(central, 24, datos.length);
    escribir16(central, 28, nombre.length);
    escribir16(central, 30, 0);
    escribir16(central, 32, 0);
    escribir16(central, 34, 0);
    escribir16(central, 36, 0);
    escribir32(central, 38, 0);
    escribir32(central, 42, offset);
    central.set(nombre, 46);
    centrales.push(central);
    offset += local.length;
  }

  const tamanoCentral = centrales.reduce((total, item) => total + item.length, 0);
  const fin = new Uint8Array(22);
  escribir32(fin, 0, 0x06054B50);
  escribir16(fin, 4, 0);
  escribir16(fin, 6, 0);
  escribir16(fin, 8, archivos.length);
  escribir16(fin, 10, archivos.length);
  escribir32(fin, 12, tamanoCentral);
  escribir32(fin, 16, offset);
  escribir16(fin, 20, 0);

  const total = offset + tamanoCentral + fin.length;
  const salida = new Uint8Array(total);
  let cursor = 0;
  for (const item of [...locales, ...centrales, fin]) {
    salida.set(item, cursor);
    cursor += item.length;
  }
  return salida;
}

export function crearArchivoXlsx({ hojas = [] } = {}) {
  if (!Array.isArray(hojas) || !hojas.length) throw new Error('El libro de Excel debe contener al menos una hoja.');
  const nombresUsados = new Set();
  const hojasNormalizadas = hojas.map((hoja, indice) => {
    let nombre = nombreHojaSeguro(hoja.nombre || `Hoja ${indice + 1}`);
    let consecutivo = 2;
    while (nombresUsados.has(nombre)) {
      nombre = `${nombreHojaSeguro(hoja.nombre).slice(0, 27)} ${consecutivo}`.slice(0, 31);
      consecutivo += 1;
    }
    nombresUsados.add(nombre);
    return { ...hoja, nombre };
  });

  const fechaIso = new Date().toISOString();
  const archivos = [
    {
      nombre: '[Content_Types].xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojasNormalizadas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    },
    {
      nombre: '_rels/.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    },
    {
      nombre: 'docProps/core.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>SIGV</dc:creator><cp:lastModifiedBy>SIGV</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${fechaIso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${fechaIso}</dcterms:modified><dc:title>Exportación de asesorías SIGV</dc:title></cp:coreProperties>`,
    },
    {
      nombre: 'docProps/app.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SIGV</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Hojas de cálculo</vt:lpstr></vt:variant><vt:variant><vt:i4>${hojasNormalizadas.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${hojasNormalizadas.length}" baseType="lpstr">${hojasNormalizadas.map(hoja => `<vt:lpstr>${limpiarXml(hoja.nombre)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`,
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets>${hojasNormalizadas.map((hoja, i) => `<sheet name="${limpiarXml(hoja.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029"/></workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojasNormalizadas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${hojasNormalizadas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nombre: 'xl/styles.xml', contenido: estilosXml() },
    ...hojasNormalizadas.map((hoja, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: hojaXml(hoja) })),
  ];

  return crearZipArchivos(archivos);
}

export function descargarLibroXlsx({ nombreArchivo = 'exportacion.xlsx', hojas = [] } = {}) {
  const datos = crearArchivoXlsx({ hojas });
  const blob = new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo.toLowerCase().endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
