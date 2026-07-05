import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const APP_VERSION = 'Fase 2.3 Web · Configuración';

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
  return {
    asesor: '',
    nombre: '',
    telefono: '',
    email: '',
    tipoCliente: 'afiliado',
    tipoSolicitud: 'primeraVez',
    fedex: '',
    documentos: crearDocumentos('primeraVez'),
    observacion: '',
    seguimiento: '',
    fechaAsesoria: '',
    horaAsesoria: '',
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

function estadoAutomaticoProceso(requeridos, data) {
  const docs = data.documentos || data.documentosObj || {};
  const completos = requeridos.filter(id => docs[id]).length;
  const documentosCompletos = completos === requeridos.length;
  const faltantes = requeridos.filter(id => !docs[id]);

  if (documentosCompletos) return 'Pendiente Agendamiento de Asesoría';
  if (faltantes.length === 1 && faltantes[0] === 'pagoAsesoria') return 'Pendiente de pago Asesoría';
  return 'Pendiente Documentación';
}

function calcularCaso(data, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const tarifas = configuracion.tarifas;
  const costos = configuracion.costos;
  const tipoCliente = data.tipoCliente || data.tipoClienteKey;
  const tipoSolicitud = data.tipoSolicitud || data.tipoSolicitudKey;
  const tarifa = tarifas[tipoCliente]?.[tipoSolicitud];
  const adicionalRenovacion = tipoSolicitud === 'renovacion' ? costos.envioDocumentacionBogota : 0;
  const requiereDerechos = tipoSolicitud === 'primeraVez' || tipoSolicitud === 'renovacion';
  const fedex = tipoSolicitud === 'primeraVez' && data.fedex ? Number(data.fedex) : 0;
  const totalPesos = (tarifa || 0) + adicionalRenovacion + fedex;
  const requeridos = documentosRequeridos(tipoSolicitud);
  const docs = data.documentos || data.documentosObj || {};
  const completos = requeridos.filter(id => docs[id]).length;
  const documentosCompletos = completos === requeridos.length;
  const estadoManualNormalizado = normalizarEstadoProceso(data.estadoManual);
  const estado = estadoManualNormalizado || estadoAutomaticoProceso(requeridos, data);
  return { tarifa, adicionalRenovacion, requiereDerechos, fedex, totalPesos, requeridos, completos, documentosCompletos, estado, derechosConsularesUsd: costos.derechosConsularesUsd };
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
    fechaAsesoria: '', horaAsesoria: '', estadoManual: '',
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
    fechaAsesoria: '', horaAsesoria: '', estadoManual: '',
    historial: [evento('Creación', 'Caso creado. Falta DS-160 y soporte de pago.', 'Ximena')],
  },
];

function prepararCasoGuardado(caso, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const calc = calcularCaso({
    tipoClienteKey: caso.tipoClienteKey,
    tipoSolicitudKey: caso.tipoSolicitudKey,
    fedex: caso.fedex || '',
    documentosObj: caso.documentosObj || {},
    estadoManual: caso.estadoManual,
  }, configuracion);
  return {
    ...caso,
    estadoManual: normalizarEstadoProceso(caso.estadoManual),
    tipoCliente: configuracion.tarifas[caso.tipoClienteKey]?.label || caso.tipoCliente,
    tipoSolicitud: textoSolicitud(caso.tipoSolicitudKey),
    total: calc.totalPesos,
    estado: calc.estado,
    documentos: `${calc.completos}/${calc.requeridos.length}`,
  };
}

function App() {
  const [logueado, setLogueado] = useState(false);
  const [usuario, setUsuario] = useState('admin');
  const [clave, setClave] = useState('1234');
  const [vista, setVista] = useState('dashboard');
  const [form, setForm] = useState(inicialFormulario);
  const [casoAbiertoId, setCasoAbiertoId] = useState(null);
  const [config, setConfig] = useState(() => {
    try {
      const guardada = localStorage.getItem('sigv_configuracion_fase23');
      return guardada ? normalizarConfiguracion(JSON.parse(guardada)) : normalizarConfiguracion(configuracionBase);
    } catch {
      return normalizarConfiguracion(configuracionBase);
    }
  });
  const [casos, setCasos] = useState(() => {
    try {
      const guardados = localStorage.getItem('sigv_casos_fase2');
      return guardados ? JSON.parse(guardados).map(c => prepararCasoGuardado(c, config)) : casosIniciales.map(c => prepararCasoGuardado(c, config));
    } catch {
      return casosIniciales.map(c => prepararCasoGuardado(c, config));
    }
  });

  useEffect(() => {
    localStorage.setItem('sigv_configuracion_fase23', JSON.stringify(config));
    setCasos(prev => prev.map(c => prepararCasoGuardado(c, config)));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('sigv_casos_fase2', JSON.stringify(casos));
  }, [casos]);

  const calculo = useMemo(() => calcularCaso(form, config), [form, config]);
  const casoAbierto = casos.find(c => c.id === casoAbiertoId);

  function validarFormulario() {
    if (!form.asesor.trim()) return 'Debes ingresar el nombre del asesor.';
    if (!form.nombre.trim()) return 'Debes ingresar el nombre completo del cliente.';
    if (!form.telefono.trim()) return 'Debes ingresar el teléfono del cliente.';
    if (!form.email.trim()) return 'Debes ingresar el email del cliente.';
    if (calculo.tarifa === null || calculo.tarifa === undefined) return 'La combinación seleccionada no aplica. Cambia el tipo de cliente o solicitud.';
    return '';
  }

  function cambiarTipoSolicitud(tipoSolicitud) {
    const documentosActuales = form.documentos || {};
    const nuevosDocs = Object.fromEntries(documentosRequeridos(tipoSolicitud).map(id => [id, !!documentosActuales[id]]));
    setForm({ ...form, tipoSolicitud, fedex: '', documentos: nuevosDocs, estadoManual: '' });
  }

  function guardarCaso(e) {
    e.preventDefault();
    const error = validarFormulario();
    if (error) {
      alert(error);
      return;
    }
    const nuevo = {
      id: generarId(casos),
      asesor: form.asesor.trim(),
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      tipoClienteKey: form.tipoCliente,
      tipoSolicitudKey: form.tipoSolicitud,
      tipoCliente: config.tarifas[form.tipoCliente].label,
      tipoSolicitud: textoSolicitud(form.tipoSolicitud),
      fedex: form.fedex,
      total: calculo.totalPesos,
      estado: calculo.estado,
      documentos: `${calculo.completos}/${calculo.requeridos.length}`,
      documentosObj: { ...form.documentos },
      observacion: form.observacion,
      seguimiento: form.seguimiento || 'Caso creado. Pendiente seguimiento.',
      fechaAsesoria: form.fechaAsesoria,
      horaAsesoria: form.horaAsesoria,
      estadoManual: form.estadoManual,
      historial: [
        evento('Creación', `Caso creado por ${form.asesor.trim()}. Documentos recibidos: ${calculo.completos}/${calculo.requeridos.length}.`, form.asesor.trim()),
      ],
    };
    setCasos(prev => [nuevo, ...prev]);
    setForm(inicialFormulario());
    setCasoAbiertoId(nuevo.id);
    setVista('detalleCaso');
  }

  function abrirCaso(id) {
    setCasoAbiertoId(id);
    setVista('detalleCaso');
  }

  function actualizarCaso(casoActualizado, motivo = 'Caso actualizado desde detalle.') {
    const calc = calcularCaso({
      tipoClienteKey: casoActualizado.tipoClienteKey,
      tipoSolicitudKey: casoActualizado.tipoSolicitudKey,
      fedex: casoActualizado.fedex || '',
      documentosObj: casoActualizado.documentosObj,
      estadoManual: casoActualizado.estadoManual,
    }, config);
    const actualizado = {
      ...casoActualizado,
      tipoCliente: config.tarifas[casoActualizado.tipoClienteKey].label,
      tipoSolicitud: textoSolicitud(casoActualizado.tipoSolicitudKey),
      total: calc.totalPesos,
      estado: calc.estado,
      documentos: `${calc.completos}/${calc.requeridos.length}`,
      historial: [...(casoActualizado.historial || []), evento('Actualización', motivo, casoActualizado.asesor || 'Sistema')],
    };
    setCasos(prev => prev.map(c => c.id === actualizado.id ? actualizado : c));
    setCasoAbiertoId(actualizado.id);
  }

  if (!logueado) {
    return <Login usuario={usuario} clave={clave} setUsuario={setUsuario} setClave={setClave} onLogin={() => usuario === 'admin' && clave === '1234' ? setLogueado(true) : alert('Usuario o clave incorrectos')} />;
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
      <button onClick={() => setLogueado(false)}>Cerrar sesión</button>
    </aside>

    <main className="content">
      <header>
        <div>
          <h1>{titulo}</h1>
          <p>Sistema Integral de Gestión de Visas · AmCham Atlántico y Magdalena</p>
        </div>
        <span>{APP_VERSION}</span>
      </header>

      {vista === 'dashboard' && <Dashboard casos={casos} onOpen={abrirCaso} />}

      {vista === 'nuevoCaso' && <NuevoCaso form={form} setForm={setForm} calculo={calculo} guardarCaso={guardarCaso} cambiarTipoSolicitud={cambiarTipoSolicitud} config={config} />}

      {vista === 'casos' && <Casos casos={casos} onOpen={abrirCaso} />}

      {vista === 'detalleCaso' && casoAbierto && <DetalleCaso caso={casoAbierto} onBack={() => setVista('casos')} onSave={actualizarCaso} config={config} />}

      {vista === 'plantillas' && <Plantillas casos={casos} onOpen={abrirCaso} />}

      {vista === 'configuracion' && <Configuracion config={config} setConfig={setConfig} />}
    </main>
  </div>;
}

function Login({ usuario, clave, setUsuario, setClave, onLogin }) {
  return <div className="login-page">
    <div className="login-card">
      <div className="brand">SIGV</div>
      <h1>Sistema Integral de Gestión de Visas</h1>
      <p>AmCham Atlántico y Magdalena</p>
      <label>Usuario
        <input value={usuario} onChange={e => setUsuario(e.target.value)} />
      </label>
      <label>Clave
        <input type="password" value={clave} onChange={e => setClave(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin()} />
      </label>
      <button onClick={onLogin}>Ingresar</button>
      <small>Usuario: admin · Clave: 1234</small>
    </div>
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
      <Card title="Total estimado" value={moneda(facturado)} />
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

function NuevoCaso({ form, setForm, calculo, guardarCaso, cambiarTipoSolicitud, config }) {
  return <form className="case-layout" onSubmit={guardarCaso}>
    <section className="panel">
      <h2>1. Asesor responsable</h2>
      <AsesorSelect value={form.asesor} onChange={v => setForm({ ...form, asesor: v })} asesoras={config.asesoras} />

      <h2>2. Datos del cliente</h2>
      <div className="two-cols">
        <Field required label="Nombre completo" value={form.nombre} onChange={v => setForm({ ...form, nombre: v })} />
        <Field required label="Teléfono" value={form.telefono} onChange={v => setForm({ ...form, telefono: v })} />
      </div>
      <Field required label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />

      <h2>3. Tipo de solicitud</h2>
      <div className="two-cols">
        <label>Tipo de cliente / paquete
          <select value={form.tipoCliente} onChange={e => setForm({ ...form, tipoCliente: e.target.value })}>
            {Object.entries(config.tarifas).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
          </select>
        </label>
        <label>Tipo de solicitud
          <select value={form.tipoSolicitud} onChange={e => cambiarTipoSolicitud(e.target.value)}>
            {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      {form.tipoSolicitud === 'primeraVez' && <label>Si la visa es aprobada, devolución de pasaporte por FedEx
        <select value={form.fedex} onChange={e => setForm({ ...form, fedex: e.target.value })}>
          <option value="">No incluir todavía</option>
          <option value={config.costos.fedexDomicilio}>Domicilio - {moneda(config.costos.fedexDomicilio)}</option>
          <option value={config.costos.fedexAltoPrado}>Recoger en FedEx Alto Prado - {moneda(config.costos.fedexAltoPrado)}</option>
        </select>
      </label>}

      <h2>4. Documentos recibidos</h2>
      <Checklist tipoSolicitud={form.tipoSolicitud} documentos={form.documentos} onChange={(id, checked) => setForm({ ...form, documentos: { ...form.documentos, [id]: checked } })} />

      <h2>5. Asesoría</h2>
      <div className="two-cols">
        <label>Fecha tentativa de asesoría
          <input type="date" value={form.fechaAsesoria} onChange={e => setForm({ ...form, fechaAsesoria: e.target.value })} />
        </label>
        <label>Hora tentativa
          <input type="time" value={form.horaAsesoria} onChange={e => setForm({ ...form, horaAsesoria: e.target.value })} />
        </label>
      </div>

      <h2>6. Observaciones iniciales</h2>
      <label>Observación
        <textarea value={form.observacion} onChange={e => setForm({ ...form, observacion: e.target.value })} placeholder="Ej: pendiente soporte de pago, cliente enviará foto mañana..." />
      </label>

      <h2>Estado del Proceso</h2>
      <label>Estado actual
        <select value={form.estadoManual || calculo.estado} onChange={e => setForm({ ...form, estadoManual: e.target.value })}>
          {estadosProceso.map(estado => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>
      <button className="primary" type="submit">Guardar caso</button>
    </section>

    <Resumen calculo={calculo} />
  </form>;
}

function Casos({ casos, onOpen }) {
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [solicitud, setSolicitud] = useState('todos');

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return casos.filter(c => {
      const coincideTexto = !q || normalizar(`${c.id} ${c.asesor} ${c.nombre} ${c.telefono} ${c.email}`).includes(q);
      const coincideEstado = estado === 'todos' || normalizar(c.estado).includes(normalizar(estado));
      const coincideSolicitud = solicitud === 'todos' || c.tipoSolicitudKey === solicitud;
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
          <th>Total</th>
          <th>Estado del Proceso</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>{casos.map(c => <tr key={c.id}>
        <td><strong>{c.id}</strong></td>
        <td>{c.asesor}</td>
        <td>{c.nombre}<br /><small>{c.email}</small></td>
        {!compacto && <td>{c.telefono}</td>}
        <td>{c.tipoSolicitud}<br /><small>{c.tipoCliente}</small></td>
        <td>{c.documentos}</td>
        <td>{moneda(c.total)}</td>
        <td><span className={claseEstado(c.estado)}>{c.estado}</span></td>
        <td><button className="small-btn" onClick={() => onOpen(c.id)}>Abrir</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function DetalleCaso({ caso, onBack, onSave, config }) {
  const [edit, setEdit] = useState({ ...caso, documentosObj: { ...caso.documentosObj } });
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState('');
  const calc = calcularCaso({ tipoClienteKey: edit.tipoClienteKey, tipoSolicitudKey: edit.tipoSolicitudKey, fedex: edit.fedex || '', documentosObj: edit.documentosObj, estadoManual: edit.estadoManual }, config);

  function cambiarSolicitudDetalle(tipoSolicitudKey) {
    const actuales = edit.documentosObj || {};
    const nuevosDocs = Object.fromEntries(documentosRequeridos(tipoSolicitudKey).map(id => [id, !!actuales[id]]));
    setEdit({ ...edit, tipoSolicitudKey, documentosObj: nuevosDocs, estadoManual: '' });
  }

  function guardar(motivo = 'Caso actualizado desde detalle.') {
    if (!edit.asesor.trim() || !edit.nombre.trim() || !edit.telefono.trim() || !edit.email.trim()) {
      alert('Asesor, nombre, teléfono y email son obligatorios.');
      return;
    }
    if (calc.tarifa === null || calc.tarifa === undefined) {
      alert('La combinación seleccionada no aplica. Cambia el tipo de cliente o solicitud.');
      return;
    }
    onSave(edit, motivo);
    alert('Caso actualizado.');
  }

  function agregarSeguimiento() {
    if (!nuevoSeguimiento.trim()) return;
    const actualizado = {
      ...edit,
      seguimiento: nuevoSeguimiento.trim(),
      historial: [...(edit.historial || []), evento('Seguimiento', nuevoSeguimiento.trim(), edit.asesor || 'Asesor')],
    };
    setEdit(actualizado);
    onSave(actualizado, 'Se agregó seguimiento al historial del caso.');
    setNuevoSeguimiento('');
  }

  function accionRapida(estadoManual, texto) {
    const actualizado = {
      ...edit,
      estadoManual,
      historial: [...(edit.historial || []), evento('Acción rápida', texto, edit.asesor || 'Asesor')],
    };
    setEdit(actualizado);
    onSave(actualizado, texto);
  }

  return <div className="detail-grid">
    <section className="panel">
      <button className="secondary" onClick={onBack}>← Volver a casos</button>
      <div className="section-title">
        <div>
          <h2>{edit.id}</h2>
          <p>{edit.nombre} · {edit.tipoSolicitud}</p>
        </div>
        <span className={claseEstado(calc.estado)}>{calc.estado}</span>
      </div>

      <div className="quick-actions">
        <button type="button" onClick={() => accionRapida('Asesoría Agendada', 'Se marcó el caso como asesoría agendada.')}>Asesoría Agendada</button>
        <button type="button" onClick={() => accionRapida('Pendiente Cita embajada', 'Se marcó el caso como pendiente de cita en embajada.')}>Pendiente Cita embajada</button>
        <button type="button" onClick={() => accionRapida('Finalizado', 'Se marcó el caso como finalizado.')}>Finalizar</button>
      </div>

      <h2>1. Asesor responsable</h2>
      <AsesorSelect value={edit.asesor} onChange={v => setEdit({ ...edit, asesor: v })} asesoras={config.asesoras} />

      <h2>2. Datos del cliente</h2>
      <div className="two-cols">
        <Field required label="Nombre completo" value={edit.nombre} onChange={v => setEdit({ ...edit, nombre: v })} />
        <Field required label="Teléfono" value={edit.telefono} onChange={v => setEdit({ ...edit, telefono: v })} />
      </div>
      <Field required label="Email" type="email" value={edit.email} onChange={v => setEdit({ ...edit, email: v })} />

      <h2>3. Tipo de solicitud</h2>
      <div className="two-cols">
        <label>Tipo de cliente / paquete
          <select value={edit.tipoClienteKey} onChange={e => setEdit({ ...edit, tipoClienteKey: e.target.value })}>
            {Object.entries(config.tarifas).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
          </select>
        </label>
        <label>Tipo de solicitud
          <select value={edit.tipoSolicitudKey} onChange={e => cambiarSolicitudDetalle(e.target.value)}>
            {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      {edit.tipoSolicitudKey === 'primeraVez' && <label>Si la visa es aprobada, devolución de pasaporte por FedEx
        <select value={edit.fedex || ''} onChange={e => setEdit({ ...edit, fedex: e.target.value })}>
          <option value="">No incluir todavía</option>
          <option value={config.costos.fedexDomicilio}>Domicilio - {moneda(config.costos.fedexDomicilio)}</option>
          <option value={config.costos.fedexAltoPrado}>Recoger en FedEx Alto Prado - {moneda(config.costos.fedexAltoPrado)}</option>
        </select>
      </label>}

      <h2>4. Documentos recibidos</h2>
      <Checklist tipoSolicitud={edit.tipoSolicitudKey} documentos={edit.documentosObj} onChange={(id, checked) => setEdit({ ...edit, documentosObj: { ...edit.documentosObj, [id]: checked } })} />

      <h2>5. Asesoría</h2>
      <div className="two-cols">
        <label>Fecha tentativa de asesoría
          <input type="date" value={edit.fechaAsesoria || ''} onChange={e => setEdit({ ...edit, fechaAsesoria: e.target.value })} />
        </label>
        <label>Hora tentativa
          <input type="time" value={edit.horaAsesoria || ''} onChange={e => setEdit({ ...edit, horaAsesoria: e.target.value })} />
        </label>
      </div>
      <h2>6. Observaciones y seguimiento</h2>
      <label>Observación general
        <textarea value={edit.observacion || ''} onChange={e => setEdit({ ...edit, observacion: e.target.value })} />
      </label>

      <h2>Estado del Proceso</h2>
      <label>Estado actual
        <select value={normalizarEstadoProceso(edit.estadoManual) || calc.estado} onChange={e => setEdit({ ...edit, estadoManual: e.target.value })}>
          {estadosProceso.map(estado => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>
      <button className="primary" onClick={() => guardar()}>Guardar cambios</button>
    </section>

    <aside className="side-stack">
      <Resumen calculo={calc} fechaAsesoria={edit.fechaAsesoria} horaAsesoria={edit.horaAsesoria} />
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
          {casos.map(c => <option key={c.id} value={c.id}>{c.id} · {c.nombre}</option>)}
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
  const faltantes = documentosRequeridos(caso.tipoSolicitudKey)
    .filter(id => !caso.documentosObj?.[id])
    .map(id => `- ${documentosCatalogo[id]?.label || id}`)
    .join('\n') || '- No hay documentos pendientes.';

  return cuerpo
    .replaceAll('{{cliente}}', caso.nombre || 'cliente')
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

function Checklist({ tipoSolicitud, documentos, onChange }) {
  return <div className="checklist">
    {documentosRequeridos(tipoSolicitud).map(id => <label key={id} className="check-item">
      <input type="checkbox" checked={!!documentos?.[id]} onChange={e => onChange(id, e.target.checked)} />
      <span>{documentosCatalogo[id]?.label || id}</span>
    </label>)}
  </div>;
}

function Resumen({ calculo, fechaAsesoria, horaAsesoria }) {
  return <section className="panel summary">
    <h2>Resumen automático</h2>
    <Line label="Valor asesoría" value={moneda(calculo.tarifa)} />
    <Line label="Envío documentación Bogotá" value={moneda(calculo.adicionalRenovacion)} />
    <Line label="FedEx devolución pasaporte" value={moneda(calculo.fedex)} />
    <Line label="Derechos consulares" value={calculo.requiereDerechos ? `USD ${calculo.derechosConsularesUsd}` : 'No aplica'} />
    <div className="total"><span>Total en pesos</span><strong>{moneda(calculo.totalPesos)}</strong></div>
    <div className={claseEstado(calculo.estado)}>{calculo.estado}</div>
    <p className="hint">Documentos recibidos: {calculo.completos}/{calculo.requeridos.length}. El estado del proceso se actualiza según los documentos recibidos o la selección manual de la asesora.</p>
    {(fechaAsesoria || horaAsesoria) && <p className="hint"><strong>Asesoría:</strong> {fechaAsesoria || 'sin fecha'} {horaAsesoria || ''}</p>}
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

function Configuracion({ config, setConfig }) {
  const [nuevaAsesora, setNuevaAsesora] = useState('');

  function actualizarTarifa(tipoCliente, campo, valor) {
    setConfig(prev => normalizarConfiguracion({
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
    setConfig(prev => normalizarConfiguracion({
      ...prev,
      costos: {
        ...prev.costos,
        [campo]: valor === '' ? 0 : Number(valor),
      },
    }));
  }

  function actualizarAsesora(indice, valor) {
    setConfig(prev => {
      const asesoras = [...prev.asesoras];
      asesoras[indice] = valor;
      return { ...prev, asesoras };
    });
  }

  function agregarAsesora() {
    const nombre = nuevaAsesora.trim();
    if (!nombre) return;
    if (config.asesoras.some(a => normalizar(a) === normalizar(nombre))) {
      alert('Esa asesora ya está registrada.');
      return;
    }
    setConfig(prev => normalizarConfiguracion({ ...prev, asesoras: [...prev.asesoras, nombre] }));
    setNuevaAsesora('');
  }

  function eliminarAsesora(indice) {
    if (config.asesoras.length === 1) {
      alert('Debe quedar al menos una asesora en configuración.');
      return;
    }
    setConfig(prev => normalizarConfiguracion({ ...prev, asesoras: prev.asesoras.filter((_, i) => i !== indice) }));
  }

  function restaurarValoresBase() {
    if (confirm('¿Deseas restaurar las tarifas, costos y asesoras base?')) {
      setConfig(normalizarConfiguracion(configuracionBase));
    }
  }

  return <div className="config-stack">
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Tarifas de asesoría</h2>
          <p>Estos valores alimentan automáticamente el cálculo de Nuevo caso, Casos y Resumen automático.</p>
        </div>
        <span className="auto-save">Guardado automático</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tipo cliente</th><th>Primera vez</th><th>Renovación</th><th>Actualización</th><th>Global Entry</th></tr></thead>
          <tbody>{Object.entries(config.tarifas).map(([id, t]) => <tr key={id}>
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
          <h2>Costos adicionales</h2>
          <p>Valores usados para envío de documentación, FedEx y derechos consulares.</p>
        </div>
      </div>
      <div className="two-cols">
        <label>Envío documentación Bogotá / Renovación
          <input type="number" min="0" value={config.costos.envioDocumentacionBogota} onChange={e => actualizarCosto('envioDocumentacionBogota', e.target.value)} />
        </label>
        <label>Derechos consulares en USD
          <input type="number" min="0" value={config.costos.derechosConsularesUsd} onChange={e => actualizarCosto('derechosConsularesUsd', e.target.value)} />
        </label>
        <label>FedEx domicilio
          <input type="number" min="0" value={config.costos.fedexDomicilio} onChange={e => actualizarCosto('fedexDomicilio', e.target.value)} />
        </label>
        <label>FedEx Alto Prado
          <input type="number" min="0" value={config.costos.fedexAltoPrado} onChange={e => actualizarCosto('fedexAltoPrado', e.target.value)} />
        </label>
      </div>
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Asesoras</h2>
          <p>Este listado se conecta con el campo Asesor responsable en Nuevo caso y Casos.</p>
        </div>
      </div>
      <div className="advisor-list">
        {config.asesoras.map((asesora, indice) => <div className="advisor-row" key={`${asesora}-${indice}`}>
          <input value={asesora} onChange={e => actualizarAsesora(indice, e.target.value)} />
          <button type="button" className="danger" onClick={() => eliminarAsesora(indice)}>Eliminar</button>
        </div>)}
      </div>
      <div className="add-row">
        <input value={nuevaAsesora} onChange={e => setNuevaAsesora(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarAsesora()} placeholder="Nombre de nueva asesora" />
        <button type="button" className="primary fit" onClick={agregarAsesora}>Agregar asesora</button>
      </div>
      <p className="hint">Si eliminas una asesora, los casos antiguos conservan su nombre, pero ya no aparecerá como opción para nuevos registros.</p>
    </section>

    <section className="panel actions-row">
      <button type="button" className="secondary fit" onClick={restaurarValoresBase}>Restaurar configuración base</button>
      <span className="hint">La configuración se guarda en el navegador durante esta fase local.</span>
    </section>
  </div>;
}

function MoneyInput({ value, onChange }) {
  return <input className="money-input" type="number" min="0" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="No aplica" />;
}

createRoot(document.getElementById('root')).render(<App />);
