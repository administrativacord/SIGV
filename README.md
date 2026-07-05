# SIGV Web - Fase 2

Sistema Integral de Gestión de Visas - AmCham Atlántico y Magdalena.

## Incluye esta fase

- Base React + Vite limpia y ejecutable.
- Login simple de prueba.
- Dashboard con métricas operativas.
- Nuevo caso con campos obligatorios: asesor, nombre completo, teléfono y email.
- Cálculo automático de tarifas, FedEx, envío de documentación y derechos consulares.
- Checklist dinámico según tipo de solicitud.
- Estado automático del caso según documentos recibidos.
- Listado de casos con búsqueda y filtros por estado y tipo de solicitud.
- Apertura y edición completa de cada caso.
- Seguimiento operativo por caso.
- Historial cronológico de movimientos.
- Acciones rápidas: asesoría agendada, DS-160 en revisión y finalizado.
- Plantillas y respuestas rápidas personalizadas por caso.
- Persistencia local en el navegador mediante localStorage.
- Tabla de tarifas y gastos adicionales.

## Ejecutar

```bash
npm install
npm run dev
```

Usuario de prueba: `admin`  
Clave: `1234`

## Notas

- Esta fase todavía no conecta Google Sheets.
- Los datos se guardan localmente en el navegador para pruebas internas.
- El ZIP oficial no incluye `node_modules/`, `dist/` ni `package-lock.json`.
