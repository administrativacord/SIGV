import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const tarifas = {
  afiliado: { label: 'Afiliado', primeraVez: 150000, renovacion: 150000, actualizacion: 75000, globalEntry: null },
  noAfiliado: { label: 'No afiliado', primeraVez: 190000, renovacion: 190000, actualizacion: 95000, globalEntry: null },
  premiumAfiliado: { label: 'Paquete Premium Afiliado', primeraVez: 210000, renovacion: 210000, actualizacion: null, globalEntry: null },
  premiumNoAfiliado: { label: 'Paquete Premium No Afiliado', primeraVez: 250000, renovacion: 250000, actualizacion: null, globalEntry: null },
  servicioAdicional: { label: 'Servicio adicional', primeraVez: null, renovacion: null, actualizacion: null, globalEntry: 100000 },
};

const tiposSolicitud = [
  { id: 'primeraVez', label: 'Primera vez' },
  { id: 'renovacion', label: 'Renovación' },
  { id: 'actualizacion', label: 'Actualización' },
  { id: 'globalEntry', label: 'Global Entry' },
];

const documentosBase = [
  { id: 'foto', label: 'Foto' },
  { id: 'pasaporte', label: 'Pasaporte' },
  { id: 'ds160', label: 'Formulario DS-160 previamente diligenciado' },
  { id: 'pagoAsesoria', label: 'Soporte de pago de la asesoría' },
];

const inicial = {
  nombre: '', telefono: '', email: '', tipoCliente: 'afiliado', tipoSolicitud: 'primeraVez',
  fedex: '', documentos: { foto: false, pasaporte: false, ds160: false, pagoAsesoria: false }, observacion: ''
};

function moneda(valor) {
  if (valor === null || valor === undefined) return 'No aplica';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
}

function App() {
  const [logueado, setLogueado] = useState(false);
  const [usuario, setUsuario] = useState('admin');
  const [clave, setClave] = useState('1234');
  const [vista, setVista] = useState('nuevoCaso');
  const [form, setForm] = useState(inicial);
  const [casos, setCasos] = useState([
    { id: 'CAS-2026-0001', nombre: 'María Gómez', telefono: '3001234567', email: 'maria@email.com', tipoCliente: 'Afiliado', tipoSolicitud: 'Renovación', total: 305000, estado: 'Documentos completos', documentos: '4/4' },
    { id: 'CAS-2026-0002', nombre: 'Carlos Pérez', telefono: '3159876543', email: 'carlos@email.com', tipoCliente: 'No afiliado', tipoSolicitud: 'Primera vez', total: 190000, estado: 'Pendiente de documentos', documentos: '2/4' },
  ]);

  const calculo = useMemo(() => {
    const tarifa = tarifas[form.tipoCliente]?.[form.tipoSolicitud];
    const adicionalRenovacion = form.tipoSolicitud === 'renovacion' ? 155000 : 0;
    const requiereDerechos = form.tipoSolicitud === 'primeraVez' || form.tipoSolicitud === 'renovacion';
    const fedex = form.tipoSolicitud === 'primeraVez' && form.fedex ? Number(form.fedex) : 0;
    const totalPesos = (tarifa || 0) + adicionalRenovacion + fedex;
    const completos = documentosBase.filter(d => form.documentos[d.id]).length;
    const documentosCompletos = completos === documentosBase.length;
    const estado = documentosCompletos ? 'Documentos completos - Listo para agendar' : 'Pendiente de documentos';
    return { tarifa, adicionalRenovacion, requiereDerechos, fedex, totalPesos, completos, documentosCompletos, estado };
  }, [form]);

  function guardarCaso(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.telefono.trim() || !form.email.trim()) {
      alert('Debes ingresar nombre, teléfono y email.');
      return;
    }
    if (calculo.tarifa === null || calculo.tarifa === undefined) {
      alert('La combinación seleccionada no aplica. Cambia el tipo de cliente o solicitud.');
      return;
    }
    const nuevo = {
      id: `CAS-2026-${String(casos.length + 1).padStart(4, '0')}`,
      nombre: form.nombre,
      telefono: form.telefono,
      email: form.email,
      tipoCliente: tarifas[form.tipoCliente].label,
      tipoSolicitud: tiposSolicitud.find(t => t.id === form.tipoSolicitud)?.label,
      total: calculo.totalPesos,
      estado: calculo.estado,
      documentos: `${calculo.completos}/4`,
    };
    setCasos([nuevo, ...casos]);
    setForm(inicial);
    setVista('casos');
  }

  if (!logueado) {
    return <div className="login-page">
      <div className="login-card">
        <div className="brand">SIGV</div>
        <h1>Sistema Integral de Gestión de Visas</h1>
        <p>AmCham Atlántico y Magdalena</p>
        <label>Usuario</label>
        <input value={usuario} onChange={e => setUsuario(e.target.value)} />
        <label>Clave</label>
        <input type="password" value={clave} onChange={e => setClave(e.target.value)} />
        <button onClick={() => usuario === 'admin' && clave === '1234' ? setLogueado(true) : alert('Usuario o clave incorrectos')}>Ingresar</button>
        <small>Usuario: admin · Clave: 1234</small>
      </div>
    </div>;
  }

  const pendientes = casos.filter(c => c.estado.includes('Pendiente')).length;
  const listos = casos.filter(c => c.estado.includes('Listo') || c.estado.includes('completos')).length;
  const facturado = casos.reduce((acc, c) => acc + c.total, 0);

  return <div className="app">
    <aside className="sidebar">
      <div className="logo">SIGV</div>
      <button className={vista==='dashboard'?'active':''} onClick={() => setVista('dashboard')}>Dashboard</button>
      <button className={vista==='nuevoCaso'?'active':''} onClick={() => setVista('nuevoCaso')}>Nuevo caso</button>
      <button className={vista==='casos'?'active':''} onClick={() => setVista('casos')}>Casos</button>
      <button className={vista==='tarifas'?'active':''} onClick={() => setVista('tarifas')}>Tarifas</button>
      <button onClick={() => setLogueado(false)}>Cerrar sesión</button>
    </aside>

    <main className="content">
      <header><h1>{vista === 'nuevoCaso' ? 'Nuevo caso de visa' : vista === 'casos' ? 'Casos registrados' : vista === 'tarifas' ? 'Tarifas' : 'Dashboard'}</h1><span>Fase 1 Web</span></header>

      {vista === 'dashboard' && <section className="grid cards">
        <Card title="Casos registrados" value={casos.length} />
        <Card title="Pendientes" value={pendientes} />
        <Card title="Listos para agendar" value={listos} />
        <Card title="Total estimado" value={moneda(facturado)} />
      </section>}

      {vista === 'nuevoCaso' && <form className="case-layout" onSubmit={guardarCaso}>
        <section className="panel">
          <h2>1. Datos del cliente</h2>
          <div className="two-cols">
            <Field label="Nombre completo" value={form.nombre} onChange={v => setForm({...form, nombre:v})} />
            <Field label="Teléfono" value={form.telefono} onChange={v => setForm({...form, telefono:v})} />
          </div>
          <Field label="Email" value={form.email} onChange={v => setForm({...form, email:v})} />

          <h2>2. Tipo de solicitud</h2>
          <div className="two-cols">
            <label>Tipo de cliente / paquete
              <select value={form.tipoCliente} onChange={e => setForm({...form, tipoCliente:e.target.value})}>
                {Object.entries(tarifas).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
              </select>
            </label>
            <label>Tipo de solicitud
              <select value={form.tipoSolicitud} onChange={e => setForm({...form, tipoSolicitud:e.target.value, fedex:''})}>
                {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          </div>
          {form.tipoSolicitud === 'primeraVez' && <label>Si la visa es aprobada, devolución de pasaporte por FedEx
            <select value={form.fedex} onChange={e => setForm({...form, fedex:e.target.value})}>
              <option value="">No incluir todavía</option>
              <option value="68000">Domicilio - $68.000</option>
              <option value="56000">Recoger en FedEx Alto Prado - $56.000</option>
            </select>
          </label>}

          <h2>3. Documentos recibidos</h2>
          <div className="checklist">
            {documentosBase.map(d => <label key={d.id} className="check-item">
              <input type="checkbox" checked={form.documentos[d.id]} onChange={e => setForm({...form, documentos: {...form.documentos, [d.id]: e.target.checked}})} />
              <span>{d.label}</span>
            </label>)}
          </div>

          <label>Observación
            <textarea value={form.observacion} onChange={e => setForm({...form, observacion:e.target.value})} placeholder="Ej: pendiente soporte de pago, cliente enviará foto mañana..." />
          </label>
          <button className="primary" type="submit">Guardar caso</button>
        </section>

        <section className="panel summary">
          <h2>Resumen automático</h2>
          <Line label="Valor asesoría" value={moneda(calculo.tarifa)} />
          <Line label="Envío documentación Bogotá" value={moneda(calculo.adicionalRenovacion)} />
          <Line label="FedEx devolución pasaporte" value={moneda(calculo.fedex)} />
          <Line label="Derechos consulares" value={calculo.requiereDerechos ? 'USD 185' : 'No aplica'} />
          <div className="total"><span>Total en pesos</span><strong>{moneda(calculo.totalPesos)}</strong></div>
          <div className={calculo.documentosCompletos ? 'status ok' : 'status warn'}>{calculo.estado}</div>
          <p className="hint">Documentos recibidos: {calculo.completos}/4. Solo se agenda asesoría cuando estén completos los 4 documentos.</p>
        </section>
      </form>}

      {vista === 'casos' && <section className="panel">
        <table>
          <thead><tr><th>ID</th><th>Cliente</th><th>Teléfono</th><th>Tipo</th><th>Solicitud</th><th>Documentos</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>{casos.map(c => <tr key={c.id}><td>{c.id}</td><td>{c.nombre}<br/><small>{c.email}</small></td><td>{c.telefono}</td><td>{c.tipoCliente}</td><td>{c.tipoSolicitud}</td><td>{c.documentos}</td><td>{moneda(c.total)}</td><td><span className={c.estado.includes('Pendiente')?'pill warn':'pill ok'}>{c.estado}</span></td></tr>)}</tbody>
        </table>
      </section>}

      {vista === 'tarifas' && <section className="panel"><Tarifas /></section>}
    </main>
  </div>;
}

function Field({ label, value, onChange }) { return <label>{label}<input value={value} onChange={e => onChange(e.target.value)} /></label>; }
function Card({ title, value }) { return <div className="card"><span>{title}</span><strong>{value}</strong></div>; }
function Line({ label, value }) { return <div className="line"><span>{label}</span><strong>{value}</strong></div>; }
function Tarifas() { return <><table><thead><tr><th>Tipo cliente</th><th>Primera vez</th><th>Renovación</th><th>Actualización</th><th>Global Entry</th></tr></thead><tbody>{Object.values(tarifas).map(t => <tr key={t.label}><td>{t.label}</td><td>{moneda(t.primeraVez)}</td><td>{moneda(t.renovacion)}</td><td>{moneda(t.actualizacion)}</td><td>{moneda(t.globalEntry)}</td></tr>)}</tbody></table><div className="notes"><p><strong>Gastos adicionales:</strong></p><p>Renovación: $155.000 envío documentación a embajada en Bogotá.</p><p>Primera vez y Renovación: derechos consulares USD 185.</p><p>Primera vez aprobada: FedEx domicilio $68.000 o FedEx Alto Prado $56.000.</p></div></>; }

createRoot(document.getElementById('root')).render(<App />);
