import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  diagnosticarFirestoreRest,
  guardarDocumentoRest,
  listarColeccionRest,
  obtenerDocumentoRest,
} from './firestoreRest';

const APP_VERSION = 'Fase 3.2 Web · Firestore REST seguro';

function conTiempoLimite(promesa, ms, mensaje) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensaje)), ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer));
}

const tarifasBase = {
  afiliado: { label: 'Afiliado', primeraVez: 150000, renovacion: 150000, actualizacion: 75000, globalEntry: null },
  noAfiliado: { label: 'No afiliado', primeraVez: 190000, renovacion: 190000, actualizacion: 95000, globalEntry: null },
  premiumAfiliado: { label: 'Paquete Premium Afiliado', primeraVez: 210000, renovacion: 210000, actualizacion: null, globalEntry: null },
  premiumNoAfiliado: { label: 'Paquete Premium No Afiliado', primeraVez: 250000, renovacion: 250000, actualizacion: null, globalEntry: null },
  servicioAdicional: { label: 'Servicio adicional', primeraVez: null, renovacion: null, actualizacion: null, globalEntry: 100000 },
};

const costosBase = {
  envioDocumentacionBogota: 155000,
  fedexDomicilio: 68000,
  fedexAltoPrado: 56000,
  derechosConsularesUsd: 185,
};

const asesorasBase = ['Milena', 'Ximena', 'Uldis'];

const configuracionBase = {
  tarifas: tarifasBase,
  costos: costosBase,
  asesoras: asesorasBase,
};

function crearFacturacion(tipoTramite = 'primeraVez') {
  return {
    nombre: '',
    cedulaNit: '',
    telefono: '',
    direccion: '',
    correo: '',
    tipoTramite,
    medioPago: '',
    valor: 0,
  };
}

function crearIdIntegrante() {
  return `integrante-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function crearIntegrante(numero = 1, base = {}) {
  const tipoCliente = base.tipoClienteKey || base.tipoCliente || 'afiliado';
  const tipoSolicitud = base.tipoSolicitudKey || base.tipoSolicitud || 'primeraVez';
  const documentosBase = base.documentosObj || base.documentos || {};
  const documentos = Object.fromEntries(documentosRequeridos(tipoSolicitud).map(id => [id, !!documentosBase[id]]));
  return {
    id: base.id || crearIdIntegrante(),
    nombre: base.nombre || '',
    telefono: base.telefono || '',
    email: base.email || '',
    tipoCliente,
    tipoSolicitud,
    tipoClienteKey: tipoCliente,
    tipoSolicitudKey: tipoSolicitud,
    fedex: base.fedex || '',
    documentos,
    documentosObj: documentos,
  };
}

function normalizarIntegrantes(data = {}) {
  const listaBase = Array.isArray(data.integrantes) && data.integrantes.length
    ? data.integrantes
    : [{
        id: data.integranteId,
        nombre: data.nombre,
        telefono: data.telefono,
        email: data.email,
        tipoCliente: data.tipoClienteKey || data.tipoCliente,
        tipoSolicitud: data.tipoSolicitudKey || data.tipoSolicitud,
        fedex: data.fedex,
        documentos: data.documentosObj || data.documentos,
      }];

  const normalizados = listaBase.map((integrante, indice) => crearIntegrante(indice + 1, integrante));
  return normalizados.length ? normalizados : [crearIntegrante(1)];
}

function serializarIntegrante(integrante, indice = 0) {
  const normalizado = crearIntegrante(indice + 1, integrante);
  return {
    id: normalizado.id,
    nombre: normalizado.nombre,
    telefono: normalizado.telefono,
    email: normalizado.email,
    tipoCliente: normalizado.tipoCliente,
    tipoSolicitud: normalizado.tipoSolicitud,
    fedex: normalizado.fedex,
    documentos: { ...normalizado.documentos },
  };
}

function primerIntegrante(data = {}) {
  return normalizarIntegrantes(data)[0] || crearIntegrante(1);
}

function ajustarCantidadIntegrantes(listaActual = [], cantidad = 1) {
  const cantidadNormalizada = Math.max(1, Math.min(30, Number(cantidad) || 1));
  const actuales = normalizarIntegrantes({ integrantes: listaActual });
  const nuevos = [...actuales];
  while (nuevos.length < cantidadNormalizada) nuevos.push(crearIntegrante(nuevos.length + 1));
  return nuevos.slice(0, cantidadNormalizada).map((integrante, indice) => crearIntegrante(indice + 1, integrante));
}

function textoClienteCaso(caso = {}) {
  const integrantes = normalizarIntegrantes(caso);
  const principal = integrantes[0];
  if (integrantes.length <= 1) return principal.nombre || caso.nombre || 'Sin nombre';
  return `${principal.nombre || 'Grupo familiar'} + ${integrantes.length - 1} integrante${integrantes.length - 1 === 1 ? '' : 's'}`;
}

function textoSolicitudesCaso(caso = {}) {
  const tipos = [...new Set(normalizarIntegrantes(caso).map(i => i.tipoSolicitud))];
  if (tipos.length <= 1) return textoSolicitud(tipos[0] || caso.tipoSolicitudKey || caso.tipoSolicitud || 'primeraVez');
  return 'Varios trámites';
}

function textoClientesCaso(caso = {}, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const tipos = [...new Set(normalizarIntegrantes(caso).map(i => i.tipoCliente))];
  if (tipos.length <= 1) return configuracion.tarifas[tipos[0]]?.label || caso.tipoCliente || '';
  return 'Varios tipos de cliente';
}

const tiposSolicitud = [
  { id: 'primeraVez', label: 'Primera vez' },
  { id: 'renovacion', label: 'Renovación' },
  { id: 'actualizacion', label: 'Actualización' },
  { id: 'globalEntry', label: 'Global Entry' },
];

const documentosCatalogo = {
  foto: { label: 'Foto' },
  pasaporte: { label: 'Pasaporte vigente' },
  ds160: { label: 'Formulario DS-160 previamente diligenciado' },
  pagoAsesoria: { label: 'Soporte de pago de la asesoría' },
  visaAnterior: { label: 'Visa anterior / información de la visa previa' },
  autorizacionEnvio: { label: 'Autorización para envío de documentación' },
  soporteActualizacion: { label: 'Soporte o datos que se van a actualizar' },
  cuentaTtp: { label: 'Cuenta TTP / PASSID para Global Entry' },
};

const documentosPorTipo = {
  primeraVez: ['foto', 'pasaporte', 'ds160', 'pagoAsesoria'],
  renovacion: ['foto', 'pasaporte', 'ds160', 'pagoAsesoria', 'visaAnterior', 'autorizacionEnvio'],
  actualizacion: ['foto', 'pasaporte', 'ds160', 'pagoAsesoria', 'soporteActualizacion'],
  globalEntry: ['pasaporte', 'pagoAsesoria', 'cuentaTtp'],
};

const estadosProceso = [
  'Pendiente Documentación',
  'Pendiente de pago Asesoría',
  'Pendiente de pago Derechos consulares',
  'Pendiente Agendamiento de Asesoría',
  'Asesoría Agendada',
  'Pendiente Facturación',
  'Pendiente Cita embajada',
  'Finalizado',
];

const plantillas = [
  {
    id: 'docsPendientes',
    titulo: 'Solicitud de documentos pendientes',
    asunto: 'Documentos pendientes para continuar con tu asesoría de visa',
    cuerpo: `Buenas tardes, {{cliente}}.

Para poder avanzar con tu caso de visa, aún tenemos pendiente recibir la siguiente documentación:

{{documentosPendientes}}

Una vez recibamos estos documentos completos, podremos continuar con la programación de tu asesoría.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
  {
    id: 'listoAgendar',
    titulo: 'Caso listo para agendar asesoría',
    asunto: 'Tu caso se encuentra listo para agendar asesoría',
    cuerpo: `Buenas tardes, {{cliente}}.

Te confirmamos que ya contamos con los documentos requeridos para tu caso. El siguiente paso es coordinar la fecha y hora de tu asesoría con el equipo de visas.

Quedamos atentos para continuar con la programación.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
  {
    id: 'confirmacionAsesoria',
    titulo: 'Confirmación de asesoría agendada',
    asunto: 'Confirmación de asesoría de visa',
    cuerpo: `Buenas tardes, {{cliente}}.

Te confirmamos que tu asesoría de visa ha sido programada para la fecha indicada por el equipo. Te recomendamos tener a la mano tu pasaporte y la información relacionada con tu viaje, estudios, trabajo y antecedentes de visas anteriores, si aplica.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
  {
    id: 'seguimientoPago',
    titulo: 'Seguimiento soporte de pago',
    asunto: 'Soporte de pago pendiente - Asesoría de visa',
    cuerpo: `Buenas tardes, {{cliente}}.

Para continuar con el proceso, agradecemos enviarnos el soporte de pago de la asesoría. Este documento es necesario para dejar tu caso habilitado y avanzar con la revisión correspondiente.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
];

function crearDocumentos(tipoSolicitud) {
  return Object.fromEntries((documentosPorTipo[tipoSolicitud] || []).map(id => [id, false]));
}

function documentosRequeridos(tipoSolicitud) {
  return documentosPorTipo[tipoSolicitud] || documentosPorTipo.primeraVez;
}

function normalizarNumero(valor, fallback = null) {
  if (valor === undefined) return fallback;
  if (valor === '' || valor === null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function normalizarConfiguracion(config = {}) {
  const tarifasGuardadas = config.tarifas || {};
  const tarifas = Object.fromEntries(Object.entries(tarifasBase).map(([id, tarifa]) => {
    const guardada = tarifasGuardadas[id] || {};
    return [id, {
      ...tarifa,
      ...guardada,
      label: guardada.label || tarifa.label,
      primeraVez: normalizarNumero(guardada.primeraVez, tarifa.primeraVez),
      renovacion: normalizarNumero(guardada.renovacion, tarifa.renovacion),
      actualizacion: normalizarNumero(guardada.actualizacion, tarifa.actualizacion),
      globalEntry: normalizarNumero(guardada.globalEntry, tarifa.globalEntry),
    }];
  }));

  const costos = {
    ...costosBase,
    ...(config.costos || {}),
    envioDocumentacionBogota: normalizarNumero(config.costos?.envioDocumentacionBogota, costosBase.envioDocumentacionBogota),
    fedexDomicilio: normalizarNumero(config.costos?.fedexDomicilio, costosBase.fedexDomicilio),
    fedexAltoPrado: normalizarNumero(config.costos?.fedexAltoPrado, costosBase.fedexAltoPrado),
    derechosConsularesUsd: normalizarNumero(config.costos?.derechosConsularesUsd, costosBase.derechosConsularesUsd),
  };

  const asesoras = Array.isArray(config.asesoras)
    ? config.asesoras.map(a => String(a || '').trim()).filter(Boolean)
    : asesorasBase;

  return { tarifas, costos, asesoras: asesoras.length ? asesoras : asesorasBase };
}

function inicialFormulario() {
  const integrantes = [crearIntegrante(1)];
  return {
    asesor: '',
    cantidad: 1,
    integrantes,
    observacion: '',
    seguimiento: '',
    fechaAsesoria: '',
    horaAsesoria: '',
    facturacion: crearFacturacion('primeraVez'),
    fechaCitaEmbajada: '',
    estadoManual: '',
  };
}

function fechaColombia() {
  return new Date().toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function moneda(valor) {
  if (valor === null || valor === undefined) return 'No aplica';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
}

function normalizar(texto = '') {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizarEstadoProceso(estado = '') {
  const limpio = String(estado || '').trim();
  const equivalencias = {
    'Pendiente de documentos': 'Pendiente Documentación',
    'Listo para agendar asesoría': 'Pendiente Agendamiento de Asesoría',
    'Asesoría agendada': 'Asesoría Agendada',
    'DS-160 en revisión': 'Pendiente Documentación',
    'Pendiente firma / aprobación del cliente': 'Pendiente Documentación',
    'Enviado a cliente': 'Pendiente Facturación',
  };
  if (estadosProceso.includes(limpio)) return limpio;
  return equivalencias[limpio] || '';
}

function porcentajeDescuentoPorCantidad(cantidad = 1) {
  const totalIntegrantes = Number(cantidad) || 1;
  if (totalIntegrantes >= 5) return 0.15;
  if (totalIntegrantes >= 3) return 0.10;
  return 0;
}

function textoDescuentoPorCantidad(cantidad = 1) {
  const porcentaje = porcentajeDescuentoPorCantidad(cantidad);
  if (!porcentaje) return 'No aplica';
  return `${Math.round(porcentaje * 100)}% por ${cantidad} integrantes`;
}

function estadoAutomaticoProceso(requeridos, data = {}) {
  const detalles = data.detalleIntegrantes || normalizarIntegrantes(data).map((integrante, indice) => {
    const tipoSolicitud = integrante.tipoSolicitudKey || integrante.tipoSolicitud;
    const requeridosIntegrante = documentosRequeridos(tipoSolicitud);
    const docs = integrante.documentosObj || integrante.documentos || {};
    const faltantes = requeridosIntegrante.filter(id => !docs[id]).map(id => ({ id, integrante: indice + 1 }));
    return { requeridos: requeridosIntegrante, faltantes };
  });

  const totalRequeridos = detalles.reduce((acc, detalle) => acc + detalle.requeridos.length, 0);
  const faltantes = detalles.flatMap(detalle => detalle.faltantes || []);

  if (totalRequeridos > 0 && faltantes.length === 0) return 'Pendiente Agendamiento de Asesoría';
  if (faltantes.length > 0 && faltantes.every(item => item.id === 'pagoAsesoria')) return 'Pendiente de pago Asesoría';
  return 'Pendiente Documentación';
}

function calcularIntegrante(integrante, config = configuracionBase, indice = 0) {
  const configuracion = normalizarConfiguracion(config);
  const tipoCliente = integrante.tipoClienteKey || integrante.tipoCliente || 'afiliado';
  const tipoSolicitud = integrante.tipoSolicitudKey || integrante.tipoSolicitud || 'primeraVez';
  const tarifa = configuracion.tarifas[tipoCliente]?.[tipoSolicitud];
  const requeridos = documentosRequeridos(tipoSolicitud);
  const docs = integrante.documentosObj || integrante.documentos || {};
  const completos = requeridos.filter(id => docs[id]).length;
  const faltantes = requeridos.filter(id => !docs[id]).map(id => ({ id, integrante: indice + 1, nombre: integrante.nombre || `Integrante ${indice + 1}` }));
  const fedex = tipoSolicitud === 'primeraVez' && integrante.fedex ? Number(integrante.fedex) : 0;
  const valorInformativoEnvioBogota = tipoSolicitud === 'renovacion' ? configuracion.costos.envioDocumentacionBogota : 0;
  const requiereDerechos = tipoSolicitud === 'primeraVez' || tipoSolicitud === 'renovacion';
  return {
    ...integrante,
    numero: indice + 1,
    tipoCliente,
    tipoSolicitud,
    tipoClienteKey: tipoCliente,
    tipoSolicitudKey: tipoSolicitud,
    tarifa,
    requeridos,
    completos,
    faltantes,
    documentosCompletos: completos === requeridos.length,
    fedex,
    valorInformativoEnvioBogota,
    requiereDerechos,
  };
}

function calcularCaso(data, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const integrantes = normalizarIntegrantes(data);
  const detalleIntegrantes = integrantes.map((integrante, indice) => calcularIntegrante(integrante, configuracion, indice));
  const subtotalAsesoria = detalleIntegrantes.reduce((acc, detalle) => acc + (Number(detalle.tarifa) || 0), 0);
  const porcentajeDescuento = porcentajeDescuentoPorCantidad(detalleIntegrantes.length);
  const valorDescuento = Math.round(subtotalAsesoria * porcentajeDescuento);
  const totalPesos = Math.max(0, subtotalAsesoria - valorDescuento);
  const valorInformativoEnvioBogota = detalleIntegrantes.reduce((acc, detalle) => acc + (Number(detalle.valorInformativoEnvioBogota) || 0), 0);
  const fedex = detalleIntegrantes.reduce((acc, detalle) => acc + (Number(detalle.fedex) || 0), 0);
  const requiereDerechos = detalleIntegrantes.some(detalle => detalle.requiereDerechos);
  const requeridos = detalleIntegrantes.flatMap(detalle => detalle.requeridos.map(id => `${detalle.numero}-${id}`));
  const completos = detalleIntegrantes.reduce((acc, detalle) => acc + detalle.completos, 0);
  const documentosCompletos = requeridos.length > 0 && completos === requeridos.length;
  const estadoManualNormalizado = normalizarEstadoProceso(data.estadoManual);
  const estado = estadoManualNormalizado || estadoAutomaticoProceso(requeridos, { detalleIntegrantes });
  return {
    tarifa: subtotalAsesoria,
    subtotalAsesoria,
    porcentajeDescuento,
    valorDescuento,
    descuentoDescripcion: textoDescuentoPorCantidad(detalleIntegrantes.length),
    valorInformativoEnvioBogota,
    adicionalRenovacion: valorInformativoEnvioBogota,
    requiereDerechos,
    fedex,
    totalPesos,
    requeridos,
    completos,
    documentosCompletos,
    estado,
    derechosConsularesUsd: configuracion.costos.derechosConsularesUsd,
    detalleIntegrantes,
    cantidad: detalleIntegrantes.length,
  };
}

function calcularValorFacturacion(facturacion = {}, tipoClienteKey = 'afiliado', config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const tipoTramite = facturacion.tipoTramite || 'primeraVez';
  const valor = configuracion.tarifas[tipoClienteKey]?.[tipoTramite];
  return valor === null || valor === undefined ? null : Number(valor);
}

function normalizarFacturacion(facturacion = {}, data = {}, config = configuracionBase, valorOverride = null) {
  const tipoTramite = facturacion.tipoTramite || data.tipoSolicitudKey || data.tipoSolicitud || 'primeraVez';
  const tipoClienteKey = data.tipoClienteKey || data.tipoCliente || 'afiliado';
  const valorCalculado = valorOverride !== null && valorOverride !== undefined
    ? Number(valorOverride)
    : calcularValorFacturacion({ tipoTramite }, tipoClienteKey, config);
  return {
    nombre: facturacion.nombre || '',
    cedulaNit: facturacion.cedulaNit || '',
    telefono: facturacion.telefono || '',
    direccion: facturacion.direccion || '',
    correo: facturacion.correo || '',
    tipoTramite,
    medioPago: facturacion.medioPago || '',
    valor: valorCalculado || 0,
  };
}

function generarTextoFacturacion(facturacion = {}, tipoClienteKey = 'afiliado', tipoSolicitudKey = 'primeraVez', config = configuracionBase, valorOverride = null, cantidadIntegrantes = 1) {
  const datos = normalizarFacturacion(facturacion, { tipoClienteKey, tipoSolicitudKey }, config, valorOverride);
  const valor = valorOverride !== null && valorOverride !== undefined ? Number(valorOverride) : calcularValorFacturacion(datos, tipoClienteKey, config);
  const lineas = [
    'DATOS DE FACTURACIÓN',
    `Nombre: ${datos.nombre || 'Pendiente'}`,
    `Cédula o NIT: ${datos.cedulaNit || 'Pendiente'}`,
    `Teléfono: ${datos.telefono || 'Pendiente'}`,
    `Dirección: ${datos.direccion || 'Pendiente'}`,
    `Correo: ${datos.correo || 'Pendiente'}`,
    `Tipo de trámite: ${textoSolicitud(datos.tipoTramite)}`,
    `Medio de pago: ${datos.medioPago || 'Pendiente'}`,
    `Valor: ${valor === null || valor === undefined ? 'No aplica' : moneda(valor)}`,
  ];
  if (Number(cantidadIntegrantes) > 1) lineas.splice(1, 0, `Cantidad de integrantes: ${cantidadIntegrantes}`);
  return lineas.join('\n');
}

function textoSolicitud(id) {
  return tiposSolicitud.find(t => t.id === id)?.label || id;
}

function generarId(casos) {
  const consecutivos = casos.map(c => Number(String(c.id || '').split('-').pop())).filter(n => !Number.isNaN(n));
  const siguiente = consecutivos.length ? Math.max(...consecutivos) + 1 : 1;
  return `CAS-2026-${String(siguiente).padStart(4, '0')}`;
}

function evento(tipo, texto, asesor = 'Sistema') {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, fecha: fechaColombia(), tipo, texto, asesor };
}

const casosIniciales = [
  {
    id: 'CAS-2026-0001', asesor: 'Milena', nombre: 'María Gómez', telefono: '3001234567', email: 'maria@email.com',
    tipoClienteKey: 'afiliado', tipoSolicitudKey: 'renovacion', tipoCliente: 'Afiliado', tipoSolicitud: 'Renovación',
    fedex: '', total: 305000, estado: 'Pendiente Agendamiento de Asesoría', documentos: '6/6',
    documentosObj: { foto: true, pasaporte: true, ds160: true, pagoAsesoria: true, visaAnterior: true, autorizacionEnvio: true },
    observacion: 'Pago validado. Pendiente agendamiento de asesoría.', seguimiento: 'Pendiente asignar horario de asesoría.',
    fechaAsesoria: '', horaAsesoria: '', facturacion: { nombre: 'María Gómez', cedulaNit: '', telefono: '3001234567', direccion: '', correo: 'maria@email.com', tipoTramite: 'renovacion', medioPago: 'Transferencia', valor: 150000 }, fechaCitaEmbajada: '', estadoManual: '',
    historial: [
      evento('Creación', 'Caso creado con documentos completos para renovación.', 'Milena'),
      evento('Seguimiento', 'Pendiente asignar horario de asesoría.', 'Milena'),
    ],
  },
  {
    id: 'CAS-2026-0002', asesor: 'Ximena', nombre: 'Carlos Pérez', telefono: '3159876543', email: 'carlos@email.com',
    tipoClienteKey: 'noAfiliado', tipoSolicitudKey: 'primeraVez', tipoCliente: 'No afiliado', tipoSolicitud: 'Primera vez',
    fedex: '', total: 190000, estado: 'Pendiente Documentación', documentos: '2/4',
    documentosObj: { foto: true, pasaporte: true, ds160: false, pagoAsesoria: false },
    observacion: 'Falta DS-160 y soporte de pago.', seguimiento: 'Cliente enviará documentos pendientes.',
    fechaAsesoria: '', horaAsesoria: '', facturacion: { nombre: 'Carlos Pérez', cedulaNit: '', telefono: '3159876543', direccion: '', correo: 'carlos@email.com', tipoTramite: 'primeraVez', medioPago: '', valor: 190000 }, fechaCitaEmbajada: '', estadoManual: '',
    historial: [evento('Creación', 'Caso creado. Falta DS-160 y soporte de pago.', 'Ximena')],
  },
];

function prepararCasoGuardado(caso, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const integrantes = normalizarIntegrantes(caso);
  const calc = calcularCaso({
    integrantes,
    estadoManual: caso.estadoManual,
  }, configuracion);
  const principal = integrantes[0] || crearIntegrante(1);
  return {
    ...caso,
    cantidad: integrantes.length,
    integrantes: integrantes.map(serializarIntegrante),
    asesor: caso.asesor || '',
    nombre: principal.nombre,
    telefono: principal.telefono,
    email: principal.email,
    tipoClienteKey: principal.tipoCliente,
    tipoSolicitudKey: principal.tipoSolicitud,
    tipoCliente: configuracion.tarifas[principal.tipoCliente]?.label || caso.tipoCliente,
    tipoSolicitud: textoSolicitud(principal.tipoSolicitud),
    fedex: principal.fedex || '',
    documentosObj: { ...principal.documentos },
    estadoManual: normalizarEstadoProceso(caso.estadoManual),
    total: calc.totalPesos,
    estado: calc.estado,
    documentos: `${calc.completos}/${calc.requeridos.length}`,
    facturacion: normalizarFacturacion(caso.facturacion, { tipoClienteKey: principal.tipoCliente, tipoSolicitudKey: principal.tipoSolicitud }, configuracion, calc.totalPesos),
    fechaCitaEmbajada: caso.fechaCitaEmbajada || '',
  };
}

function App() {
  const [logueado, setLogueado] = useState(false);
  const [usuarioAuth, setUsuarioAuth] = useState(null);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [vista, setVista] = useState('dashboard');
  const [form, setForm] = useState(inicialFormulario);
  const [casoAbiertoId, setCasoAbiertoId] = useState(null);
  const [config, setConfigState] = useState(() => normalizarConfiguracion(configuracionBase));
  const [casos, setCasos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorConexion, setErrorConexion] = useState('');
  const [diagnostico, setDiagnostico] = useState('');

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, user => {
      setUsuarioAuth(user);
      setLogueado(!!user);
      setCargando(false);
      if (!user) {
        setCasos([]);
        setConfigState(normalizarConfiguracion(configuracionBase));
      }
    });
    return cancelar;
  }, []);

  useEffect(() => {
    if (!usuarioAuth) return undefined;
    let activo = true;

    async function cargarDesdeFirestore() {
      setCargando(true);
      setErrorConexion('');
      setDiagnostico('');
      try {
        const [configRemota, casosRemotos] = await Promise.all([
          conTiempoLimite(obtenerDocumentoRest('configuracion', 'general'), 18000, 'No respondió la configuración de Firestore.'),
          conTiempoLimite(listarColeccionRest('casos'), 18000, 'No respondió la colección de casos de Firestore.'),
        ]);

        if (!activo) return;

        const configLimpia = normalizarConfiguracion(configRemota || configuracionBase);
        setConfigState(configLimpia);
        localStorage.setItem('sigv_configuracion_fase3_backup', JSON.stringify(configLimpia));

        const lista = casosRemotos
          .map(item => prepararCasoGuardado(item, configLimpia))
          .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setCasos(lista);
        localStorage.setItem('sigv_casos_fase3_backup', JSON.stringify(lista));
      } catch (error) {
        if (!activo) return;
        console.error('Error cargando Firestore por REST:', error);

        const respaldoConfig = localStorage.getItem('sigv_configuracion_fase3_backup');
        const respaldoCasos = localStorage.getItem('sigv_casos_fase3_backup');

        if (respaldoConfig) {
          try {
            setConfigState(normalizarConfiguracion(JSON.parse(respaldoConfig)));
          } catch (parseError) {
            console.error('Error leyendo respaldo de configuración:', parseError);
          }
        }

        if (respaldoCasos) {
          try {
            setCasos(JSON.parse(respaldoCasos).map(c => prepararCasoGuardado(c, config)));
          } catch (parseError) {
            console.error('Error leyendo respaldo de casos:', parseError);
          }
        }

        setErrorConexion(`No se pudo cargar Firestore. Detalle: ${error.message || error.code || 'error desconocido'}. Verifica que Cloud Firestore esté creado en modo nativo, que las reglas estén publicadas y que la red permita firestore.googleapis.com.`);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarDesdeFirestore();

    return () => {
      activo = false;
    };
  }, [usuarioAuth]);

  useEffect(() => {
    setCasos(prev => prev.map(c => prepararCasoGuardado(c, config)));
  }, [config]);

  const calculo = useMemo(() => calcularCaso(form, config), [form, config]);
  const casoAbierto = casos.find(c => c.id === casoAbiertoId);

  async function iniciarSesion(e) {
    e?.preventDefault?.();
    if (!usuario.trim() || !clave.trim()) {
      alert('Debes ingresar correo y contraseña.');
      return;
    }
    try {
      setGuardando(true);
      await signInWithEmailAndPassword(auth, usuario.trim(), clave);
    } catch (error) {
      console.error('Error de login:', error);
      alert('No se pudo iniciar sesión. Verifica que el usuario exista en Firebase Authentication y que la contraseña sea correcta.');
    } finally {
      setGuardando(false);
    }
  }

  async function cerrarSesion() {
    await signOut(auth);
    setVista('dashboard');
    setCasoAbiertoId(null);
  }

  async function ejecutarDiagnosticoFirestore() {
    try {
      setDiagnostico('Ejecutando prueba de conexión con Firestore...');
      const resultado = await diagnosticarFirestoreRest();
      setDiagnostico(`Conexión Firestore OK por REST. Tiempo aproximado: ${resultado.ms} ms.`);
      setErrorConexion('');
    } catch (error) {
      console.error('Diagnóstico Firestore:', error);
      setDiagnostico(`Diagnóstico Firestore falló: ${error.message || error.code || 'error desconocido'}.`);
    }
  }

  function validarFormulario() {
    if (!form.asesor.trim()) return 'Debes ingresar el nombre del asesor.';
    const integrantes = normalizarIntegrantes(form);
    if (!integrantes.length) return 'Debes registrar al menos un integrante.';
    for (const [indice, integrante] of integrantes.entries()) {
      const numero = indice + 1;
      if (!integrante.nombre.trim()) return `Debes ingresar el nombre completo del integrante ${numero}.`;
      if (!integrante.telefono.trim()) return `Debes ingresar el teléfono del integrante ${numero}.`;
      const tarifa = config.tarifas[integrante.tipoCliente]?.[integrante.tipoSolicitud];
      if (tarifa === null || tarifa === undefined) return `La combinación seleccionada para el integrante ${numero} no aplica. Cambia el tipo de cliente o solicitud.`;
    }
    return '';
  }

  async function guardarCaso(e) {
    e.preventDefault();
    const error = validarFormulario();
    if (error) {
      alert(error);
      return;
    }
    const integrantes = normalizarIntegrantes(form);
    const principal = integrantes[0];
    const id = generarId(casos);
    const creadoPor = usuarioAuth?.email || 'Sistema';
    const nuevo = {
      id,
      asesor: form.asesor.trim(),
      cantidad: integrantes.length,
      integrantes: integrantes.map(serializarIntegrante),
      nombre: principal.nombre.trim(),
      telefono: principal.telefono.trim(),
      email: principal.email.trim(),
      tipoClienteKey: principal.tipoCliente,
      tipoSolicitudKey: principal.tipoSolicitud,
      tipoCliente: config.tarifas[principal.tipoCliente].label,
      tipoSolicitud: textoSolicitud(principal.tipoSolicitud),
      fedex: principal.fedex,
      total: calculo.totalPesos,
      subtotalAsesoria: calculo.subtotalAsesoria,
      porcentajeDescuento: calculo.porcentajeDescuento,
      valorDescuento: calculo.valorDescuento,
      estado: calculo.estado,
      documentos: `${calculo.completos}/${calculo.requeridos.length}`,
      documentosObj: { ...principal.documentos },
      observacion: form.observacion,
      seguimiento: form.seguimiento || 'Caso creado. Pendiente seguimiento.',
      fechaAsesoria: form.fechaAsesoria,
      horaAsesoria: form.horaAsesoria,
      facturacion: normalizarFacturacion(form.facturacion, { tipoClienteKey: principal.tipoCliente, tipoSolicitudKey: principal.tipoSolicitud }, config, calculo.totalPesos),
      fechaCitaEmbajada: form.fechaCitaEmbajada,
      estadoManual: form.estadoManual,
      creadoPor,
      actualizadoPor: creadoPor,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      historial: [
        evento('Creación', `Caso creado por ${form.asesor.trim()}. Integrantes: ${integrantes.length}. Documentos recibidos: ${calculo.completos}/${calculo.requeridos.length}.`, form.asesor.trim()),
      ],
    };

    try {
      setGuardando(true);
      await conTiempoLimite(guardarDocumentoRest('casos', id, {
        ...nuevo,
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      }), 20000, 'Firestore no respondió al guardar el caso en 20 segundos.');
      setCasos(prev => [nuevo, ...prev.filter(c => c.id !== id)]);
      setForm(inicialFormulario());
      setCasoAbiertoId(id);
      setVista('detalleCaso');
    } catch (error) {
      console.error('Error guardando caso:', error);
      alert(`No se pudo guardar el caso en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}. Revisa la conexión, las reglas de seguridad y que Firestore Database esté activo.`);
    } finally {
      setGuardando(false);
    }
  }

  function abrirCaso(id) {
    setCasoAbiertoId(id);
    setVista('detalleCaso');
  }

  async function actualizarCaso(casoActualizado, motivo = 'Caso actualizado desde detalle.') {
    const integrantes = normalizarIntegrantes(casoActualizado);
    const principal = integrantes[0] || crearIntegrante(1);
    const calc = calcularCaso({
      integrantes,
      estadoManual: casoActualizado.estadoManual,
    }, config);
    const actualizadoPor = usuarioAuth?.email || 'Sistema';
    const actualizado = {
      ...casoActualizado,
      cantidad: integrantes.length,
      integrantes: integrantes.map(serializarIntegrante),
      nombre: principal.nombre,
      telefono: principal.telefono,
      email: principal.email,
      tipoClienteKey: principal.tipoCliente,
      tipoSolicitudKey: principal.tipoSolicitud,
      tipoCliente: config.tarifas[principal.tipoCliente]?.label || casoActualizado.tipoCliente,
      tipoSolicitud: textoSolicitud(principal.tipoSolicitud),
      fedex: principal.fedex || '',
      documentosObj: { ...principal.documentos },
      total: calc.totalPesos,
      subtotalAsesoria: calc.subtotalAsesoria,
      porcentajeDescuento: calc.porcentajeDescuento,
      valorDescuento: calc.valorDescuento,
      estado: calc.estado,
      documentos: `${calc.completos}/${calc.requeridos.length}`,
      facturacion: normalizarFacturacion(casoActualizado.facturacion, { tipoClienteKey: principal.tipoCliente, tipoSolicitudKey: principal.tipoSolicitud }, config, calc.totalPesos),
      fechaCitaEmbajada: casoActualizado.fechaCitaEmbajada || '',
      actualizadoPor,
      updatedAtMs: Date.now(),
      historial: [...(casoActualizado.historial || []), evento('Actualización', motivo, casoActualizado.asesor || 'Sistema')],
    };

    try {
      setGuardando(true);
      await conTiempoLimite(guardarDocumentoRest('casos', actualizado.id, {
        ...actualizado,
        updatedAtIso: new Date().toISOString(),
      }), 20000, 'Firestore no respondió al actualizar el caso en 20 segundos.');
      setCasos(prev => prev.map(c => c.id === actualizado.id ? actualizado : c));
      setCasoAbiertoId(actualizado.id);
    } catch (error) {
      console.error('Error actualizando caso:', error);
      alert(`No se pudo actualizar el caso en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarConfigFirestore(nuevaConfig) {
    const limpia = normalizarConfiguracion(nuevaConfig);
    try {
      setGuardando(true);
      await conTiempoLimite(guardarDocumentoRest('configuracion', 'general', {
        ...limpia,
        updatedAtIso: new Date().toISOString(),
        updatedAtMs: Date.now(),
        actualizadoPor: usuarioAuth?.email || 'Sistema',
      }), 20000, 'Firestore no respondió al guardar la configuración en 20 segundos.');
      setConfigState(limpia);
      localStorage.setItem('sigv_configuracion_fase3_backup', JSON.stringify(limpia));
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert(`No se pudo guardar la configuración en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
      throw error;
    } finally {
      setGuardando(false);
    }
  }

  if (!logueado) {
    return <Login usuario={usuario} clave={clave} setUsuario={setUsuario} setClave={setClave} onLogin={iniciarSesion} guardando={guardando} />;
  }

  const titulo = vista === 'nuevoCaso' ? 'Nuevo caso de visa'
    : vista === 'casos' ? 'Casos registrados'
    : vista === 'detalleCaso' ? 'Detalle y seguimiento del caso'
    : vista === 'plantillas' ? 'Plantillas y respuestas rápidas'
    : vista === 'configuracion' ? 'Configuración'
    : 'Dashboard';

  return <div className="app">
    <aside className="sidebar">
      <div className="logo">SIGV</div>
      <button className={vista === 'dashboard' ? 'active' : ''} onClick={() => setVista('dashboard')}>Dashboard</button>
      <button className={vista === 'nuevoCaso' ? 'active' : ''} onClick={() => setVista('nuevoCaso')}>Nuevo caso</button>
      <button className={vista === 'casos' || vista === 'detalleCaso' ? 'active' : ''} onClick={() => setVista('casos')}>Casos</button>
      <button className={vista === 'plantillas' ? 'active' : ''} onClick={() => setVista('plantillas')}>Plantillas</button>
      <button className={vista === 'configuracion' ? 'active' : ''} onClick={() => setVista('configuracion')}>Configuración</button>
      <button onClick={cerrarSesion}>Cerrar sesión</button>
    </aside>

    <main className="content">
      <header>
        <div>
          <h1>{titulo}</h1>
          <p>Sistema Integral de Gestión de Visas · AmCham Atlántico y Magdalena</p>
        </div>
        <span>{APP_VERSION}</span>
      </header>

      <div className="connection-row">
        <span className="pill ok">Firebase conectado</span>
        <small>{usuarioAuth?.email}</small>
        {guardando && <small>Guardando cambios...</small>}
        <button className="mini-button" type="button" onClick={ejecutarDiagnosticoFirestore}>Probar Firestore</button>
      </div>

      {diagnostico && <div className="alert-box diagnostic">{diagnostico}</div>}
      {errorConexion && <div className="alert-box">{errorConexion}</div>}
      {cargando && <div className="empty">Cargando información desde Firestore...</div>}

      {!cargando && vista === 'dashboard' && <Dashboard casos={casos} onOpen={abrirCaso} />}

      {!cargando && vista === 'nuevoCaso' && <NuevoCaso form={form} setForm={setForm} calculo={calculo} guardarCaso={guardarCaso} config={config} guardando={guardando} />}

      {!cargando && vista === 'casos' && <Casos casos={casos} onOpen={abrirCaso} />}

      {!cargando && vista === 'detalleCaso' && casoAbierto && <DetalleCaso caso={casoAbierto} onBack={() => setVista('casos')} onSave={actualizarCaso} config={config} guardando={guardando} />}

      {!cargando && vista === 'detalleCaso' && !casoAbierto && <div className="empty">El caso seleccionado aún se está cargando o no existe.</div>}

      {!cargando && vista === 'plantillas' && <Plantillas casos={casos} onOpen={abrirCaso} />}

      {!cargando && vista === 'configuracion' && <Configuracion config={config} setConfig={guardarConfigFirestore} />}
    </main>
  </div>;
}

function Login({ usuario, clave, setUsuario, setClave, onLogin, guardando = false }) {
  return <div className="login-page">
    <form className="login-card" onSubmit={onLogin}>
      <div className="brand">SIGV</div>
      <h1>Sistema Integral de Gestión de Visas</h1>
      <p>AmCham Atlántico y Magdalena</p>
      <label>Correo electrónico
        <input type="email" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="usuario@empresa.com" autoComplete="email" />
      </label>
      <label>Contraseña
        <input type="password" value={clave} onChange={e => setClave(e.target.value)} autoComplete="current-password" />
      </label>
      <button type="submit" disabled={guardando}>{guardando ? 'Ingresando...' : 'Ingresar con Firebase'}</button>
      <small>El usuario debe estar creado en Firebase Authentication con proveedor Email/Password.</small>
    </form>
  </div>;
}

function Dashboard({ casos, onOpen }) {
  const pendientes = casos.filter(c => c.estado.includes('Pendiente')).length;
  const listos = casos.filter(c => c.estado.includes('Pendiente Agendamiento')).length;
  const agendados = casos.filter(c => c.estado.includes('Asesoría Agendada')).length;
  const facturado = casos.reduce((acc, c) => acc + (Number(c.total) || 0), 0);
  const recientes = casos.slice(0, 5);

  return <>
    <section className="grid cards">
      <Card title="Casos registrados" value={casos.length} />
      <Card title="Pendientes" value={pendientes} />
      <Card title="Pendientes agendamiento" value={listos} />
      <Card title="Asesorías agendadas" value={agendados} />
      <Card title="Facturación estimada AmCham" value={moneda(facturado)} />
    </section>
    <section className="panel mt">
      <div className="section-title">
        <h2>Casos recientes</h2>
        <span>Seguimiento rápido</span>
      </div>
      <CaseTable casos={recientes} onOpen={onOpen} compacto />
    </section>
  </>;
}

function NuevoCaso({ form, setForm, calculo, guardarCaso, config, guardando = false }) {
  const integrantes = normalizarIntegrantes(form);
  const principal = integrantes[0] || crearIntegrante(1);

  function cambiarCantidad(valor) {
    const nuevaCantidad = Math.max(1, Math.min(30, Number(valor) || 1));
    const nuevosIntegrantes = ajustarCantidadIntegrantes(integrantes, nuevaCantidad);
    setForm({ ...form, cantidad: nuevaCantidad, integrantes: nuevosIntegrantes });
  }

  function actualizarIntegrantes(nuevosIntegrantes) {
    setForm({ ...form, cantidad: nuevosIntegrantes.length, integrantes: nuevosIntegrantes, estadoManual: '' });
  }

  return <form className="case-layout single-case-layout" onSubmit={guardarCaso}>
    <section className="panel">
      <h2>1. Asesor responsable</h2>
      <AsesorSelect value={form.asesor} onChange={v => setForm({ ...form, asesor: v })} asesoras={config.asesoras} />

      <h2>2. Cantidad</h2>
      <label>Cantidad de integrantes del caso
        <input type="number" min="1" max="30" value={integrantes.length} onChange={e => cambiarCantidad(e.target.value)} />
      </label>
      <p className="hint">Usa este campo cuando el caso sea de un grupo familiar o tenga varios solicitantes. Según la cantidad, se despliegan datos, solicitud y documentos para cada integrante.</p>

      <IntegrantesSecciones integrantes={integrantes} onChange={actualizarIntegrantes} config={config} />

      <h2>6. Asesoría</h2>
      <div className="two-cols">
        <label>Fecha tentativa de asesoría
          <input type="date" value={form.fechaAsesoria} onChange={e => setForm({ ...form, fechaAsesoria: e.target.value })} />
        </label>
        <label>Hora tentativa
          <input type="time" value={form.horaAsesoria} onChange={e => setForm({ ...form, horaAsesoria: e.target.value })} />
        </label>
      </div>

      <h2>7. Facturación</h2>
      <FacturacionFields
        data={form.facturacion}
        onChange={facturacion => setForm({ ...form, facturacion })}
        tipoClienteKey={principal.tipoCliente}
        tipoSolicitudKey={principal.tipoSolicitud}
        datosCliente={{ nombre: principal.nombre, telefono: principal.telefono, correo: principal.email }}
        config={config}
        valorCaso={calculo.totalPesos}
        cantidadIntegrantes={integrantes.length}
      />

      <h2>8. Fecha Cita embajada</h2>
      <label>Fecha Cita embajada
        <input type="date" value={form.fechaCitaEmbajada} onChange={e => setForm({ ...form, fechaCitaEmbajada: e.target.value })} />
      </label>

      <h2>Observaciones y seguimiento</h2>
      <label>Observación
        <textarea value={form.observacion} onChange={e => setForm({ ...form, observacion: e.target.value })} placeholder="Ej: pendiente soporte de pago, cliente enviará foto mañana..." />
      </label>
      <label>Seguimiento inicial
        <textarea value={form.seguimiento} onChange={e => setForm({ ...form, seguimiento: e.target.value })} placeholder="Ej: se debe llamar al cliente, confirmar documentos o validar pago..." />
      </label>

      <h2>Estado del Proceso</h2>
      <label>Estado actual
        <select value={form.estadoManual || calculo.estado} onChange={e => setForm({ ...form, estadoManual: e.target.value })}>
          {estadosProceso.map(estado => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>

      <Resumen calculo={calculo} facturacion={form.facturacion} tipoClienteKey={principal.tipoCliente} config={config} fechaAsesoria={form.fechaAsesoria} horaAsesoria={form.horaAsesoria} fechaCitaEmbajada={form.fechaCitaEmbajada} cantidadIntegrantes={integrantes.length} compacto />

      <button className="primary" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar caso'}</button>
    </section>
  </form>;
}

function IntegrantesSecciones({ integrantes, onChange, config }) {
  const lista = normalizarIntegrantes({ integrantes });

  function actualizarIntegrante(indice, cambios) {
    const nuevos = lista.map((integrante, i) => i === indice ? crearIntegrante(i + 1, { ...integrante, ...cambios }) : integrante);
    onChange(nuevos);
  }

  function cambiarSolicitud(indice, tipoSolicitud) {
    const integrante = lista[indice];
    const documentosActuales = integrante.documentos || {};
    const nuevosDocs = Object.fromEntries(documentosRequeridos(tipoSolicitud).map(id => [id, !!documentosActuales[id]]));
    actualizarIntegrante(indice, { tipoSolicitud, tipoSolicitudKey: tipoSolicitud, fedex: '', documentos: nuevosDocs, documentosObj: nuevosDocs });
  }

  return <>
    <h2>3. Datos del cliente</h2>
    <div className="integrantes-stack">
      {lista.map((integrante, indice) => <div className="integrante-card" key={integrante.id}>
        <div className="integrante-title">Integrante {indice + 1}</div>
        <div className="two-cols">
          <Field required label="Nombre completo" value={integrante.nombre} onChange={v => actualizarIntegrante(indice, { nombre: v })} />
          <Field required label="Teléfono" value={integrante.telefono} onChange={v => actualizarIntegrante(indice, { telefono: v })} />
        </div>
        <Field label="Email" type="email" value={integrante.email} onChange={v => actualizarIntegrante(indice, { email: v })} />
      </div>)}
    </div>

    <h2>4. Tipo de solicitud</h2>
    <div className="integrantes-stack">
      {lista.map((integrante, indice) => <div className="integrante-card" key={`${integrante.id}-solicitud`}>
        <div className="integrante-title">Integrante {indice + 1} · {integrante.nombre || 'Sin nombre'}</div>
        <div className="two-cols">
          <label>Tipo de cliente / paquete
            <select value={integrante.tipoCliente} onChange={e => actualizarIntegrante(indice, { tipoCliente: e.target.value, tipoClienteKey: e.target.value })}>
              {Object.entries(config.tarifas).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </select>
          </label>
          <label>Tipo de solicitud
            <select value={integrante.tipoSolicitud} onChange={e => cambiarSolicitud(indice, e.target.value)}>
              {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
        </div>
        {integrante.tipoSolicitud === 'primeraVez' && <label>Valor informativo FedEx si la visa es aprobada
          <select value={integrante.fedex || ''} onChange={e => actualizarIntegrante(indice, { fedex: e.target.value })}>
            <option value="">No aplica / pendiente por definir</option>
            <option value={config.costos.fedexDomicilio}>Domicilio - {moneda(config.costos.fedexDomicilio)}</option>
            <option value={config.costos.fedexAltoPrado}>Recoger en FedEx Alto Prado - {moneda(config.costos.fedexAltoPrado)}</option>
          </select>
        </label>}
      </div>)}
    </div>

    <h2>5. Documentos recibidos</h2>
    <div className="integrantes-stack">
      {lista.map((integrante, indice) => <div className="integrante-card" key={`${integrante.id}-docs`}>
        <div className="integrante-title">Integrante {indice + 1} · {integrante.nombre || textoSolicitud(integrante.tipoSolicitud)}</div>
        <Checklist tipoSolicitud={integrante.tipoSolicitud} documentos={integrante.documentos} onChange={(id, checked) => actualizarIntegrante(indice, { documentos: { ...integrante.documentos, [id]: checked }, documentosObj: { ...integrante.documentos, [id]: checked } })} />
      </div>)}
    </div>
  </>;
}

function Casos({ casos, onOpen }) {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [solicitud, setSolicitud] = useState('todos');

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return casos.filter(c => {
      const coincideTexto = !q || normalizar(`${c.id} ${c.asesor} ${c.nombre} ${c.telefono} ${c.email} ${normalizarIntegrantes(c).map(i => `${i.nombre} ${i.telefono} ${i.email}`).join(' ')}`).includes(q);
      const coincideEstado = estado === 'todos' || normalizar(c.estado).includes(normalizar(estado));
      const coincideSolicitud = solicitud === 'todos' || normalizarIntegrantes(c).some(i => i.tipoSolicitud === solicitud);
      return coincideTexto && coincideEstado && coincideSolicitud;
    });
  }, [busqueda, estado, solicitud, casos]);

  return <section className="panel">
    <div className="toolbar">
      <label>Buscar caso
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="ID, cliente, teléfono, asesor o email" />
      </label>
      <label>Estado del Proceso
        <select value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="todos">Todos</option>
          {estadosProceso.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </label>
      <label>Solicitud
        <select value={solicitud} onChange={e => setSolicitud(e.target.value)}>
          <option value="todos">Todas</option>
          {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
    </div>
    <p className="hint">Mostrando {filtrados.length} de {casos.length} casos registrados.</p>
    <CaseTable casos={filtrados} onOpen={onOpen} />
  </section>;
}

function CaseTable({ casos, onOpen, compacto = false }) {
  if (!casos.length) return <div className="empty">No hay casos para mostrar con los filtros seleccionados.</div>;
  return <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Asesor</th>
          <th>Cliente</th>
          {!compacto && <th>Teléfono</th>}
          <th>Solicitud</th>
          <th>Documentos</th>
          <th>Facturación AmCham</th>
          <th>Estado del Proceso</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>{casos.map(c => <tr key={c.id}>
        <td><strong>{c.id}</strong></td>
        <td>{c.asesor}</td>
        <td>{textoClienteCaso(c)}<br /><small>{normalizarIntegrantes(c).length} integrante{normalizarIntegrantes(c).length === 1 ? '' : 's'}{c.email ? ` · ${c.email}` : ''}</small></td>
        {!compacto && <td>{c.telefono}</td>}
        <td>{textoSolicitudesCaso(c)}<br /><small>{textoClientesCaso(c)}</small></td>
        <td>{c.documentos}</td>
        <td>{moneda(c.total)}</td>
        <td><span className={claseEstado(c.estado)}>{c.estado}</span></td>
        <td><button className="small-btn" onClick={() => onOpen(c.id)}>Abrir</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function DetalleCaso({ caso, onBack, onSave, config, guardando = false }) {
  const [edit, setEdit] = useState(() => ({ ...caso, integrantes: normalizarIntegrantes(caso).map(serializarIntegrante) }));
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState('');
  const integrantes = normalizarIntegrantes(edit);
  const principal = integrantes[0] || crearIntegrante(1);
  const calc = calcularCaso({ integrantes, estadoManual: edit.estadoManual }, config);

  function cambiarCantidad(valor) {
    const nuevaCantidad = Math.max(1, Math.min(30, Number(valor) || 1));
    const nuevosIntegrantes = ajustarCantidadIntegrantes(integrantes, nuevaCantidad);
    setEdit({ ...edit, cantidad: nuevaCantidad, integrantes: nuevosIntegrantes, estadoManual: '' });
  }

  function actualizarIntegrantes(nuevosIntegrantes) {
    setEdit({ ...edit, cantidad: nuevosIntegrantes.length, integrantes: nuevosIntegrantes, estadoManual: '' });
  }

  function guardar(motivo = 'Caso actualizado desde detalle.') {
    if (!edit.asesor.trim()) {
      alert('El asesor responsable es obligatorio.');
      return;
    }
    for (const [indice, integrante] of integrantes.entries()) {
      const numero = indice + 1;
      if (!integrante.nombre.trim() || !integrante.telefono.trim()) {
        alert(`Nombre y teléfono son obligatorios para el integrante ${numero}.`);
        return;
      }
      const tarifa = config.tarifas[integrante.tipoCliente]?.[integrante.tipoSolicitud];
      if (tarifa === null || tarifa === undefined) {
        alert(`La combinación seleccionada para el integrante ${numero} no aplica. Cambia el tipo de cliente o solicitud.`);
        return;
      }
    }
    onSave({ ...edit, integrantes }, motivo);
    alert('Caso actualizado.');
  }

  function agregarSeguimiento() {
    if (!nuevoSeguimiento.trim()) return;
    const actualizado = {
      ...edit,
      integrantes,
      seguimiento: nuevoSeguimiento.trim(),
      historial: [...(edit.historial || []), evento('Seguimiento', nuevoSeguimiento.trim(), edit.asesor || 'Asesor')],
    };
    setEdit(actualizado);
    onSave(actualizado, 'Se agregó seguimiento al historial del caso.');
    setNuevoSeguimiento('');
  }

  return <div className="detail-grid">
    <section className="panel">
      <button className="secondary" onClick={onBack}>← Volver a casos</button>
      <div className="section-title">
        <div>
          <h2>{edit.id}</h2>
          <p>{textoClienteCaso(edit)} · {integrantes.length} integrante{integrantes.length === 1 ? '' : 's'}</p>
        </div>
        <span className={claseEstado(calc.estado)}>{calc.estado}</span>
      </div>

      <h2>1. Asesor responsable</h2>
      <AsesorSelect value={edit.asesor} onChange={v => setEdit({ ...edit, asesor: v })} asesoras={config.asesoras} />

      <h2>2. Cantidad</h2>
      <label>Cantidad de integrantes del caso
        <input type="number" min="1" max="30" value={integrantes.length} onChange={e => cambiarCantidad(e.target.value)} />
      </label>
      <p className="hint">Al aumentar la cantidad se habilitan nuevos campos de datos, solicitud y documentos. Al reducirla, se eliminan los últimos integrantes del formulario.</p>

      <IntegrantesSecciones integrantes={integrantes} onChange={actualizarIntegrantes} config={config} />

      <h2>6. Asesoría</h2>
      <div className="two-cols">
        <label>Fecha tentativa de asesoría
          <input type="date" value={edit.fechaAsesoria || ''} onChange={e => setEdit({ ...edit, fechaAsesoria: e.target.value })} />
        </label>
        <label>Hora tentativa
          <input type="time" value={edit.horaAsesoria || ''} onChange={e => setEdit({ ...edit, horaAsesoria: e.target.value })} />
        </label>
      </div>

      <h2>7. Facturación</h2>
      <FacturacionFields
        data={edit.facturacion}
        onChange={facturacion => setEdit({ ...edit, facturacion })}
        tipoClienteKey={principal.tipoCliente}
        tipoSolicitudKey={principal.tipoSolicitud}
        datosCliente={{ nombre: principal.nombre, telefono: principal.telefono, correo: principal.email }}
        config={config}
        valorCaso={calc.totalPesos}
        cantidadIntegrantes={integrantes.length}
      />

      <h2>8. Fecha Cita embajada</h2>
      <label>Fecha Cita embajada
        <input type="date" value={edit.fechaCitaEmbajada || ''} onChange={e => setEdit({ ...edit, fechaCitaEmbajada: e.target.value })} />
      </label>

      <h2>Observaciones y seguimiento</h2>
      <label>Observación general
        <textarea value={edit.observacion || ''} onChange={e => setEdit({ ...edit, observacion: e.target.value })} />
      </label>
      <label>Seguimiento actual
        <textarea value={edit.seguimiento || ''} onChange={e => setEdit({ ...edit, seguimiento: e.target.value })} />
      </label>

      <h2>Estado del Proceso</h2>
      <label>Estado actual
        <select value={normalizarEstadoProceso(edit.estadoManual) || calc.estado} onChange={e => setEdit({ ...edit, estadoManual: e.target.value })}>
          {estadosProceso.map(estado => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>
      <button className="primary" onClick={() => guardar()} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
    </section>

    <aside className="side-stack">
      <Resumen calculo={calc} facturacion={edit.facturacion} tipoClienteKey={principal.tipoCliente} config={config} fechaAsesoria={edit.fechaAsesoria} horaAsesoria={edit.horaAsesoria} fechaCitaEmbajada={edit.fechaCitaEmbajada} cantidadIntegrantes={integrantes.length} />
      <section className="panel">
        <h2>Nuevo seguimiento</h2>
        <textarea value={nuevoSeguimiento} onChange={e => setNuevoSeguimiento(e.target.value)} placeholder="Ej: se llamó al cliente, falta soporte, asesoría reagendada..." />
        <button className="primary" onClick={agregarSeguimiento}>Agregar al historial</button>
      </section>
      <Historial historial={edit.historial || []} />
    </aside>
  </div>;
}

function Plantillas({ casos, onOpen }) {
  const [plantillaId, setPlantillaId] = useState(plantillas[0].id);
  const [casoId, setCasoId] = useState(casos[0]?.id || '');
  const [copiado, setCopiado] = useState(false);
  const plantilla = plantillas.find(p => p.id === plantillaId) || plantillas[0];
  const caso = casos.find(c => c.id === casoId) || casos[0];
  const texto = aplicarPlantilla(plantilla.cuerpo, caso);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`Asunto: ${plantilla.asunto}\n\n${texto}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      alert('No se pudo copiar automáticamente. Puedes seleccionar el texto manualmente.');
    }
  }

  return <section className="panel">
    <div className="toolbar">
      <label>Plantilla
        <select value={plantillaId} onChange={e => setPlantillaId(e.target.value)}>
          {plantillas.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
        </select>
      </label>
      <label>Caso relacionado
        <select value={caso?.id || ''} onChange={e => setCasoId(e.target.value)}>
          {casos.map(c => <option key={c.id} value={c.id}>{c.id} · {textoClienteCaso(c)}</option>)}
        </select>
      </label>
    </div>

    {!caso && <div className="empty">Crea un caso para poder personalizar plantillas.</div>}
    {caso && <>
      <div className="template-box">
        <strong>Asunto sugerido:</strong>
        <p>{plantilla.asunto}</p>
        <textarea value={texto} readOnly />
      </div>
      <div className="actions-row">
        <button className="primary fit" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar plantilla'}</button>
        <button className="secondary fit" onClick={() => onOpen(caso.id)}>Abrir caso relacionado</button>
      </div>
    </>}
  </section>;
}

function aplicarPlantilla(cuerpo, caso) {
  if (!caso) return cuerpo;
  const integrantes = normalizarIntegrantes(caso);
  const faltantes = integrantes.flatMap((integrante, indice) => documentosRequeridos(integrante.tipoSolicitud)
    .filter(id => !integrante.documentos?.[id])
    .map(id => `- Integrante ${indice + 1} (${integrante.nombre || 'sin nombre'}): ${documentosCatalogo[id]?.label || id}`))
    .join('\n') || '- No hay documentos pendientes.';
  const cliente = integrantes.length > 1 ? `${integrantes[0]?.nombre || 'cliente'} y grupo familiar` : (integrantes[0]?.nombre || caso.nombre || 'cliente');

  return cuerpo
    .replaceAll('{{cliente}}', cliente)
    .replaceAll('{{asesor}}', caso.asesor || 'Equipo de visas')
    .replaceAll('{{documentosPendientes}}', faltantes);
}

function Historial({ historial }) {
  return <section className="panel">
    <h2>Historial cronológico</h2>
    {!historial.length && <p className="hint">Aún no hay movimientos registrados.</p>}
    <div className="timeline">
      {historial.slice().reverse().map(item => <div className="timeline-item" key={item.id}>
        <strong>{item.tipo}</strong>
        <span>{item.fecha} · {item.asesor}</span>
        <p>{item.texto}</p>
      </div>)}
    </div>
  </section>;
}

function FacturacionFields({ data, onChange, tipoClienteKey, tipoSolicitudKey, datosCliente = {}, config, valorCaso = null, cantidadIntegrantes = 1 }) {
  const [copiadoFacturacion, setCopiadoFacturacion] = useState(false);
  const valorFinal = valorCaso !== null && valorCaso !== undefined ? Number(valorCaso) : null;
  const facturacion = normalizarFacturacion(data, { tipoClienteKey, tipoSolicitudKey }, config, valorFinal);
  const valor = valorFinal !== null ? valorFinal : calcularValorFacturacion(facturacion, tipoClienteKey, config);

  function actualizar(campo, valorCampo) {
    onChange(normalizarFacturacion({ ...facturacion, [campo]: valorCampo }, { tipoClienteKey, tipoSolicitudKey }, config, valorFinal));
  }

  function copiarDatosCliente() {
    onChange(normalizarFacturacion({
      ...facturacion,
      nombre: datosCliente.nombre || facturacion.nombre,
      telefono: datosCliente.telefono || facturacion.telefono,
      correo: datosCliente.correo || facturacion.correo,
      tipoTramite: tipoSolicitudKey || facturacion.tipoTramite,
    }, { tipoClienteKey, tipoSolicitudKey }, config, valorFinal));
  }

  async function copiarDatosFacturacion() {
    const texto = generarTextoFacturacion(facturacion, tipoClienteKey, tipoSolicitudKey, config, valor, cantidadIntegrantes);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoFacturacion(true);
      setTimeout(() => setCopiadoFacturacion(false), 1800);
    } catch {
      alert('No se pudo copiar automáticamente. Puedes seleccionar los datos manualmente.');
    }
  }

  return <div className="facturacion-box">
    <div className="actions-row compact">
      <button type="button" className="secondary fit" onClick={copiarDatosCliente}>Copiar datos del cliente</button>
      <button type="button" className="primary fit" onClick={copiarDatosFacturacion}>{copiadoFacturacion ? 'Datos copiados' : 'Copiar datos Facturación'}</button>
      <span className="hint">El valor corresponde a la facturación AmCham del caso. Si hay descuentos por cantidad, ya quedan aplicados en el total.</span>
    </div>
    <div className="two-cols">
      <Field label="Nombre" value={facturacion.nombre} onChange={v => actualizar('nombre', v)} />
      <Field label="Cédula o NIT" value={facturacion.cedulaNit} onChange={v => actualizar('cedulaNit', v)} />
      <Field label="Teléfono" value={facturacion.telefono} onChange={v => actualizar('telefono', v)} />
      <Field label="Dirección" value={facturacion.direccion} onChange={v => actualizar('direccion', v)} />
      <Field label="Correo" type="email" value={facturacion.correo} onChange={v => actualizar('correo', v)} />
      <label>Tipo de trámite
        <select value={facturacion.tipoTramite} onChange={e => actualizar('tipoTramite', e.target.value)}>
          {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label>Medio de pago
        <select value={facturacion.medioPago} onChange={e => actualizar('medioPago', e.target.value)}>
          <option value="">Seleccionar medio de pago</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Efectivo">Efectivo</option>
        </select>
      </label>
      <label>Valor
        <input readOnly value={valor === null ? 'No aplica' : moneda(valor)} />
      </label>
    </div>
  </div>;
}

function Checklist({ tipoSolicitud, documentos, onChange }) {
  return <div className="checklist">
    {documentosRequeridos(tipoSolicitud).map(id => <label key={id} className="check-item">
      <input type="checkbox" checked={!!documentos?.[id]} onChange={e => onChange(id, e.target.checked)} />
      <span>{documentosCatalogo[id]?.label || id}</span>
    </label>)}
  </div>;
}

function Resumen({ calculo, facturacion, tipoClienteKey, config, fechaAsesoria, horaAsesoria, fechaCitaEmbajada, cantidadIntegrantes = 1, compacto = false }) {
  const facturacionNormalizada = normalizarFacturacion(facturacion, { tipoClienteKey }, config, calculo.totalPesos);
  const clases = compacto ? 'panel summary summary-compact' : 'panel summary';
  return <section className={clases}>
    <h2>Resumen automático</h2>
    <div className="summary-grid">
      <Line label="Integrantes" value={calculo.cantidad || cantidadIntegrantes || 1} />
      <Line label="Subtotal asesoría" value={moneda(calculo.subtotalAsesoria ?? calculo.tarifa)} />
      <Line label="Descuento por cantidad" value={calculo.valorDescuento ? `${calculo.descuentoDescripcion} · -${moneda(calculo.valorDescuento)}` : 'No aplica'} />
      <div className="total"><span>Total a facturar por AmCham</span><strong>{moneda(calculo.totalPesos)}</strong></div>
    </div>
    {!compacto && calculo.detalleIntegrantes?.length > 1 && <div className="info-box muted">
      <strong>Detalle por integrante</strong>
      {calculo.detalleIntegrantes.map(detalle => <Line key={detalle.id} label={`Integrante ${detalle.numero} · ${detalle.nombre || textoSolicitud(detalle.tipoSolicitud)}`} value={`${textoSolicitud(detalle.tipoSolicitud)} · ${moneda(detalle.tarifa)}`} />)}
    </div>}
    <div className="info-box">
      <strong>Valores informativos para el cliente</strong>
      {!compacto && <p>Estos valores no ingresan a AmCham y no hacen parte de nuestra facturación. Se muestran únicamente para que el cliente los tenga en cuenta en su presupuesto y los pague directamente cuando corresponda.</p>}
      <Line label="Envío Bogotá / Renovación" value={calculo.valorInformativoEnvioBogota ? moneda(calculo.valorInformativoEnvioBogota) : 'No aplica'} />
      <Line label="FedEx" value={calculo.fedex ? moneda(calculo.fedex) : 'No aplica / pendiente'} />
      <Line label="Derechos consulares" value={calculo.requiereDerechos ? `USD ${calculo.derechosConsularesUsd}` : 'No aplica'} />
    </div>
    <div className={claseEstado(calculo.estado)}>{calculo.estado}</div>
    <p className="hint">Documentos: {calculo.completos}/{calculo.requeridos.length}. El estado se calcula con todos los integrantes o la selección manual.</p>
    {(fechaAsesoria || horaAsesoria) && <p className="hint"><strong>Asesoría:</strong> {fechaAsesoria || 'sin fecha'} {horaAsesoria || ''}</p>}
    {!compacto && facturacion && <div className="info-box muted">
      <strong>Facturación</strong>
      <Line label="Nombre" value={facturacionNormalizada.nombre || 'Pendiente'} />
      <Line label="Tipo de trámite" value={textoSolicitud(facturacionNormalizada.tipoTramite)} />
      <Line label="Medio de pago" value={facturacionNormalizada.medioPago || 'Pendiente'} />
      <Line label="Valor" value={facturacionNormalizada.valor ? moneda(facturacionNormalizada.valor) : 'No aplica'} />
    </div>}
    {fechaCitaEmbajada && <p className="hint"><strong>Fecha Cita embajada:</strong> {fechaCitaEmbajada}</p>}
  </section>;
}

function AsesorSelect({ value, onChange, asesoras }) {
  const asesorasLimpias = asesoras.map(a => String(a || '').trim()).filter(Boolean);
  const existeSeleccion = value && asesorasLimpias.includes(value);
  return <label>Nombre del asesor<span className="required">Obligatorio</span>
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Seleccionar asesora</option>
      {!existeSeleccion && value && <option value={value}>{value} · no está en configuración</option>}
      {asesorasLimpias.map(asesora => <option key={asesora} value={asesora}>{asesora}</option>)}
    </select>
  </label>;
}

function Field({ label, value, onChange, required = false, type = 'text' }) {
  return <label>{label}{required && <span className="required">Obligatorio</span>}<input type={type} value={value} onChange={e => onChange(e.target.value)} /></label>;
}

function Card({ title, value }) {
  return <div className="card"><span>{title}</span><strong>{value}</strong></div>;
}

function Line({ label, value }) {
  return <div className="line"><span>{label}</span><strong>{value}</strong></div>;
}

function claseEstado(estado = '') {
  if (estado.includes('Finalizado')) return 'pill done';
  if (estado.includes('Asesoría Agendada') || estado.includes('Cita embajada')) return 'pill info';
  if (estado.includes('Pendiente')) return 'pill warn';
  return 'pill ok';
}


function ModalNotificacion({ modal, onClose, onConfirm }) {
  if (!modal) return null;
  const esConfirmacion = modal.tipo === 'confirmacion';
  return <div className="modal-overlay" role="dialog" aria-modal="true">
    <div className="modal-card">
      <h2>{modal.titulo}</h2>
      <p>{modal.mensaje}</p>
      <div className="modal-actions">
        {esConfirmacion && <button type="button" className="secondary fit" onClick={onClose}>Cancelar</button>}
        <button type="button" className="primary fit" onClick={esConfirmacion ? onConfirm : onClose}>{modal.boton || 'Aceptar'}</button>
      </div>
    </div>
  </div>;
}

function Configuracion({ config, setConfig }) {
  const [borrador, setBorrador] = useState(() => normalizarConfiguracion(config));
  const [nuevaAsesora, setNuevaAsesora] = useState('');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    setBorrador(normalizarConfiguracion(config));
  }, [config]);

  function mostrarModal(titulo, mensaje, tipo = 'info', onConfirm = null) {
    setModal({ titulo, mensaje, tipo, onConfirm, boton: tipo === 'confirmacion' ? 'Confirmar' : 'Aceptar' });
  }

  function cerrarModal() {
    setModal(null);
  }

  function confirmarModal() {
    const accion = modal?.onConfirm;
    setModal(null);
    if (accion) accion();
  }

  function actualizarTarifa(tipoCliente, campo, valor) {
    setBorrador(prev => normalizarConfiguracion({
      ...prev,
      tarifas: {
        ...prev.tarifas,
        [tipoCliente]: {
          ...prev.tarifas[tipoCliente],
          [campo]: valor === '' ? null : Number(valor),
        },
      },
    }));
  }

  function actualizarCosto(campo, valor) {
    setBorrador(prev => normalizarConfiguracion({
      ...prev,
      costos: {
        ...prev.costos,
        [campo]: valor === '' ? 0 : Number(valor),
      },
    }));
  }

  function actualizarAsesora(indice, valor) {
    setBorrador(prev => {
      const asesoras = [...prev.asesoras];
      asesoras[indice] = valor;
      return { ...prev, asesoras };
    });
  }

  function agregarAsesora() {
    const nombre = nuevaAsesora.trim();
    if (!nombre) return;
    if (borrador.asesoras.some(a => normalizar(a) === normalizar(nombre))) {
      mostrarModal('Asesora duplicada', 'Esa asesora ya está registrada en la configuración.');
      return;
    }
    setBorrador(prev => normalizarConfiguracion({ ...prev, asesoras: [...prev.asesoras, nombre] }));
    setNuevaAsesora('');
  }

  function eliminarAsesora(indice) {
    if (borrador.asesoras.length === 1) {
      mostrarModal('No se puede eliminar', 'Debe quedar al menos una asesora en configuración.');
      return;
    }
    const nombre = borrador.asesoras[indice];
    mostrarModal(
      'Eliminar asesora',
      `¿Deseas eliminar a ${nombre} del listado de asesoras? Los casos antiguos conservarán su nombre, pero ya no aparecerá como opción para nuevos registros.`,
      'confirmacion',
      () => setBorrador(prev => normalizarConfiguracion({ ...prev, asesoras: prev.asesoras.filter((_, i) => i !== indice) }))
    );
  }

  function restaurarValoresBase() {
    mostrarModal(
      'Restaurar configuración base',
      '¿Deseas restaurar las tarifas, valores informativos y asesoras base? Recuerda que el cambio solo quedará aplicado cuando presiones Guardar.',
      'confirmacion',
      () => setBorrador(normalizarConfiguracion(configuracionBase))
    );
  }

  async function guardarConfiguracion() {
    const limpia = normalizarConfiguracion(borrador);
    try {
      await setConfig(limpia);
      mostrarModal('Configuración guardada', 'Los cambios fueron guardados correctamente en Firestore y ya se reflejan en Nuevo caso, Casos y Resumen automático.');
    } catch {
      mostrarModal('Error al guardar', 'No se pudo guardar la configuración en Firestore. Revisa la conexión o las reglas de seguridad.');
    }
  }

  return <div className="config-stack">
    <ModalNotificacion modal={modal} onClose={cerrarModal} onConfirm={confirmarModal} />

    <section className="panel notice-panel">
      <div>
        <h2>Configuración</h2>
        <p>Los cambios que hagas en esta sección quedan como borrador hasta presionar el botón <strong>Guardar</strong>. Esta será la única manera de aplicar modificaciones de tarifas, valores informativos o asesoras.</p>
      </div>
      <button type="button" className="primary fit" onClick={guardarConfiguracion}>Guardar</button>
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Tarifas de asesoría</h2>
          <p>Estos valores sí corresponden a ingresos/facturación de AmCham y alimentan el cálculo de Nuevo caso, Casos y Resumen automático.</p>
        </div>
        <span className="pending-save">Pendiente guardar</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tipo cliente</th><th>Primera vez</th><th>Renovación</th><th>Actualización</th><th>Global Entry</th></tr></thead>
          <tbody>{Object.entries(borrador.tarifas).map(([id, t]) => <tr key={id}>
            <td><strong>{t.label}</strong></td>
            <td><MoneyInput value={t.primeraVez} onChange={v => actualizarTarifa(id, 'primeraVez', v)} /></td>
            <td><MoneyInput value={t.renovacion} onChange={v => actualizarTarifa(id, 'renovacion', v)} /></td>
            <td><MoneyInput value={t.actualizacion} onChange={v => actualizarTarifa(id, 'actualizacion', v)} /></td>
            <td><MoneyInput value={t.globalEntry} onChange={v => actualizarTarifa(id, 'globalEntry', v)} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="hint">Deja un campo vacío cuando esa combinación no aplique.</p>
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Valores informativos para el cliente</h2>
          <p>Estos valores no suman a la facturación de AmCham. Solo sirven para informar al cliente costos que debe pagar directamente a terceros, al consulado o al proveedor correspondiente.</p>
        </div>
      </div>
      <div className="two-cols">
        <label>Envío documentación Bogotá / Renovación
          <input type="number" min="0" value={borrador.costos.envioDocumentacionBogota} onChange={e => actualizarCosto('envioDocumentacionBogota', e.target.value)} />
        </label>
        <label>Derechos consulares en USD
          <input type="number" min="0" value={borrador.costos.derechosConsularesUsd} onChange={e => actualizarCosto('derechosConsularesUsd', e.target.value)} />
        </label>
        <label>FedEx domicilio
          <input type="number" min="0" value={borrador.costos.fedexDomicilio} onChange={e => actualizarCosto('fedexDomicilio', e.target.value)} />
        </label>
        <label>FedEx Alto Prado
          <input type="number" min="0" value={borrador.costos.fedexAltoPrado} onChange={e => actualizarCosto('fedexAltoPrado', e.target.value)} />
        </label>
      </div>
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Asesoras</h2>
          <p>Este listado se conecta con el campo Asesor responsable en Nuevo caso y Casos después de guardar la configuración.</p>
        </div>
      </div>
      <div className="advisor-list">
        {borrador.asesoras.map((asesora, indice) => <div className="advisor-row" key={`${asesora}-${indice}`}>
          <input value={asesora} onChange={e => actualizarAsesora(indice, e.target.value)} />
          <button type="button" className="danger" onClick={() => eliminarAsesora(indice)}>Eliminar</button>
        </div>)}
      </div>
      <div className="add-row">
        <input value={nuevaAsesora} onChange={e => setNuevaAsesora(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarAsesora()} placeholder="Nombre de nueva asesora" />
        <button type="button" className="primary fit" onClick={agregarAsesora}>Agregar asesora</button>
      </div>
      <p className="hint">Si eliminas una asesora, los casos antiguos conservan su nombre, pero ya no aparecerá como opción para nuevos registros después de guardar.</p>
    </section>

    <section className="panel actions-row">
      <button type="button" className="secondary fit" onClick={restaurarValoresBase}>Restaurar configuración base</button>
      <button type="button" className="primary fit" onClick={guardarConfiguracion}>Guardar</button>
      <span className="hint">La configuración se guarda en Firebase Firestore. Los valores informativos no se suman a la facturación de AmCham.</span>
    </section>
  </div>;
}

function MoneyInput({ value, onChange }) {
  return <input className="money-input" type="number" min="0" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="No aplica" />;
}

createRoot(document.getElementById('root')).render(<App />);
