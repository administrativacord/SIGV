import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Users, LayoutDashboard, BriefcaseBusiness, ClipboardList, CreditCard, Search, LogOut, Plus, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';
import './styles.css';

const clientesIniciales = [
  { id: 'CLI-2026-0001', nombre: 'María Fernanda López', empresa: 'DSAB', celular: '3001234567', email: 'maria@correo.com', pasaporte: 'AB123456', ciudad: 'Barranquilla', estado: 'Activo' },
  { id: 'CLI-2026-0002', nombre: 'Carlos Méndez', empresa: 'Particular', celular: '3019876543', email: 'carlos@correo.com', pasaporte: 'CD987654', ciudad: 'Santa Marta', estado: 'Activo' },
  { id: 'CLI-2026-0003', nombre: 'Ana Rodríguez', empresa: 'Empresa Afiliada', celular: '', email: 'ana@correo.com', pasaporte: 'EF456789', ciudad: 'Barranquilla', estado: 'Pendiente de datos' }
];

const casosIniciales = [
  { id: 'CAS-2026-0001', cliente: 'María Fernanda López', asesora: 'Milena', tipo: 'Renovación', visa: 'B1/B2', estado: 'En proceso', ds160: 'Creado', cita: 'Pendiente', resultado: 'No informado', valor: 190000 },
  { id: 'CAS-2026-0002', cliente: 'Carlos Méndez', asesora: 'Milena', tipo: 'Primera vez', visa: 'B1/B2', estado: 'Pendiente de cliente', ds160: 'Pendiente', cita: 'Pendiente', resultado: 'No informado', valor: 220000 },
  { id: 'CAS-2026-0003', cliente: 'Ana Rodríguez', asesora: 'Karol', tipo: 'Actualización', visa: 'B1/B2', estado: 'Cerrado aprobado', ds160: 'Creado', cita: 'Escogida', resultado: 'Aprobada', valor: 150000 }
];

function money(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
}

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('admin');
  const [clave, setClave] = useState('1234');
  const [error, setError] = useState('');

  const entrar = (e) => {
    e.preventDefault();
    if (usuario.trim() === 'admin' && clave.trim() === '1234') onLogin();
    else setError('Usuario o clave incorrectos. Usa admin / 1234 para probar.');
  };

  return <div className="login-page">
    <form className="login-card" onSubmit={entrar}>
      <div className="brand-mark">SIGV</div>
      <h1>Sistema Integral de Gestión de Visas</h1>
      <p>AmCham Atlántico y Magdalena</p>
      <label>Usuario</label>
      <input value={usuario} onChange={e => setUsuario(e.target.value)} />
      <label>Clave</label>
      <input type="password" value={clave} onChange={e => setClave(e.target.value)} />
      {error && <div className="error">{error}</div>}
      <button className="primary">Ingresar</button>
      <small>Usuario de prueba: admin · Clave: 1234</small>
    </form>
  </div>;
}

function App() {
  const [logueado, setLogueado] = useState(false);
  const [vista, setVista] = useState('dashboard');
  const [clientes, setClientes] = useState(clientesIniciales);
  const [casos, setCasos] = useState(casosIniciales);

  if (!logueado) return <Login onLogin={() => setLogueado(true)} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo">SIGV</div>
      <button className={vista==='dashboard'?'active':''} onClick={() => setVista('dashboard')}><LayoutDashboard size={18}/> Dashboard</button>
      <button className={vista==='clientes'?'active':''} onClick={() => setVista('clientes')}><Users size={18}/> Clientes</button>
      <button className={vista==='casos'?'active':''} onClick={() => setVista('casos')}><BriefcaseBusiness size={18}/> Casos</button>
      <button className={vista==='seguimiento'?'active':''} onClick={() => setVista('seguimiento')}><ClipboardList size={18}/> Seguimiento</button>
      <button className={vista==='pagos'?'active':''} onClick={() => setVista('pagos')}><CreditCard size={18}/> Pagos</button>
      <button className="logout" onClick={() => setLogueado(false)}><LogOut size={18}/> Salir</button>
    </aside>
    <main className="content">
      <Header vista={vista}/>
      {vista === 'dashboard' && <Dashboard clientes={clientes} casos={casos}/>} 
      {vista === 'clientes' && <Clientes clientes={clientes} setClientes={setClientes}/>} 
      {vista === 'casos' && <Casos casos={casos}/>} 
      {vista === 'seguimiento' && <Seguimiento casos={casos}/>} 
      {vista === 'pagos' && <Pagos casos={casos}/>} 
    </main>
  </div>;
}

function Header({ vista }) {
  const titulos = { dashboard: 'Dashboard', clientes: 'Clientes', casos: 'Casos de visa', seguimiento: 'Seguimiento', pagos: 'Pagos' };
  return <header className="topbar">
    <div><h2>{titulos[vista]}</h2><p>Fase 1 Web · Datos de prueba</p></div>
    <div className="user-chip">Milena / Admin</div>
  </header>;
}

function Dashboard({ clientes, casos }) {
  const total = casos.reduce((acc, c) => acc + c.valor, 0);
  const pendientes = casos.filter(c => !['Cerrado aprobado','Cerrado negado'].includes(c.estado)).length;
  const sinDs = casos.filter(c => c.ds160 === 'Pendiente').length;
  const sinCita = casos.filter(c => c.cita === 'Pendiente').length;
  return <>
    <div className="cards">
      <Card label="Clientes" value={clientes.length} />
      <Card label="Casos activos" value={pendientes} />
      <Card label="Total registrado" value={money(total)} />
      <Card label="Sin DS-160" value={sinDs} warning />
      <Card label="Sin cita" value={sinCita} warning />
    </div>
    <section className="panel">
      <h3>Alertas rápidas</h3>
      <div className="alert-list">
        {casos.filter(c => c.ds160 === 'Pendiente' || c.cita === 'Pendiente').map(c => <div className="alert-item" key={c.id}><AlertTriangle size={18}/> {c.cliente} tiene pendientes en el caso {c.id}</div>)}
      </div>
    </section>
  </>;
}
function Card({ label, value, warning }) { return <div className={warning?'card warning':'card'}><span>{label}</span><strong>{value}</strong></div> }

function Clientes({ clientes, setClientes }) {
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState({ nombre:'', empresa:'', celular:'', email:'', pasaporte:'', ciudad:'Barranquilla' });
  const filtrados = clientes.filter(c => JSON.stringify(c).toLowerCase().includes(q.toLowerCase()));
  const agregar = () => {
    if (!nuevo.nombre.trim()) return alert('El nombre es obligatorio');
    setClientes([...clientes, { id:`CLI-2026-${String(clientes.length+1).padStart(4,'0')}`, ...nuevo, estado: nuevo.celular && nuevo.email && nuevo.pasaporte ? 'Activo':'Pendiente de datos' }]);
    setNuevo({ nombre:'', empresa:'', celular:'', email:'', pasaporte:'', ciudad:'Barranquilla' });
  };
  return <div className="grid-two">
    <section className="panel">
      <h3><Plus size={18}/> Nuevo cliente</h3>
      <input placeholder="Nombre completo" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo,nombre:e.target.value})}/>
      <input placeholder="Empresa" value={nuevo.empresa} onChange={e=>setNuevo({...nuevo,empresa:e.target.value})}/>
      <input placeholder="Celular" value={nuevo.celular} onChange={e=>setNuevo({...nuevo,celular:e.target.value})}/>
      <input placeholder="Email" value={nuevo.email} onChange={e=>setNuevo({...nuevo,email:e.target.value})}/>
      <input placeholder="Pasaporte" value={nuevo.pasaporte} onChange={e=>setNuevo({...nuevo,pasaporte:e.target.value})}/>
      <button className="primary" onClick={agregar}>Guardar cliente</button>
    </section>
    <section className="panel">
      <div className="search"><Search size={18}/><input placeholder="Buscar cliente..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      <Table rows={filtrados} cols={['id','nombre','empresa','celular','pasaporte','estado']} />
    </section>
  </div>;
}

function Casos({ casos }) { return <section className="panel"><Table rows={casos} cols={['id','cliente','asesora','tipo','visa','estado','resultado']} /></section>; }
function Seguimiento({ casos }) { return <section className="panel"><h3>Seguimiento por caso</h3>{casos.map(c => <div className="timeline" key={c.id}><h4>{c.id} · {c.cliente}</h4><p><CheckCircle2 size={16}/> Caso creado</p><p>DS-160: {c.ds160}</p><p>Cita: {c.cita}</p><p>Resultado: {c.resultado}</p></div>)}</section>; }
function Pagos({ casos }) { return <section className="panel"><Table rows={casos.map(c=>({...c, valor: money(c.valor), pago:'Pagado'}))} cols={['id','cliente','tipo','valor','pago']} /></section>; }

function Table({ rows, cols }) { return <div className="table-wrap"><table><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}<th>Acción</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c}>{r[c]}</td>)}<td><button className="mini"><Eye size={15}/> Ver</button></td></tr>)}</tbody></table></div>; }

createRoot(document.getElementById('root')).render(<App />);
