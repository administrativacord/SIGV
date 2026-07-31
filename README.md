# SIGV Web — Fase 5C.10 · Reconciliación de visas facturadas de julio

Base oficial: `2.9.9_SIGV_Web_Fase_5C9_Migracion_Facturacion_Julio.zip`.

- Versión interna: `5.2.10`
- Build: `2026-07-31-05C10`

## Motivo del ajuste

Después de continuar registrando asesorías, el Dashboard pasó de mostrar `60 facturadas / 42 en julio` a `72 facturadas / 54 en julio`. La diferencia permaneció exactamente en 18 visas. Esto confirmó que las asesorías nuevas sí estaban entrando correctamente al reporte mensual y que el problema correspondía a un bloque histórico fijo de 18 visas.

La Fase 5C.9 podía detectar registros antiguos, pero en algunos casos conservaba un periodo contable anterior o no reconocido y también podía conservar una cantidad histórica menor. Por eso esos registros seguían dentro del acumulado general, pero no completaban el total mensual de julio.

## Reconciliación automática reforzada

Al ingresar con un Administrador, SIGV revisa únicamente asesorías históricas que:

- estén marcadas como Facturadas;
- hayan sido creadas en julio de 2026;
- no correspondan a una facturación automática real registrada por las versiones nuevas; y
- estén fuera de julio, tengan auditoría incompleta o una cantidad facturada distinta de sus integrantes actuales.

Para esos registros:

- asigna `1 de julio de 2026`;
- fuerza el periodo contable `2026-07`;
- actualiza la cantidad de visas facturadas con la cantidad real de integrantes;
- conserva o congela el valor facturado;
- añade una anotación al historial;
- guarda `facturacion.migracionJulio2026Completada: true`.

Las facturaciones nuevas registradas correctamente no se modifican. Por ejemplo, una asesoría creada en julio y facturada realmente en agosto conserva agosto como su periodo de facturación.

## Resultado esperado

Con los datos reportados al momento del ajuste, después de que un Administrador ejecute la reconciliación, julio debería pasar de:

- Acumulado general facturado: 72 visas
- Facturado en julio: 54 visas

A:

- Acumulado general facturado: 72 visas
- Facturado en julio: 72 visas

El resultado exacto puede aumentar si se registran o facturan nuevas asesorías antes de publicar, pero la diferencia histórica fija de 18 debe desaparecer.

## Publicación

```bash
npm install --package-lock=false
npm run check
npm run build
```

Publica el frontend y luego:

1. Cierra sesión y vuelve a ingresar con una cuenta Administrador, o recarga completamente la aplicación.
2. Abre **Estado de la app**.
3. Confirma el mensaje de reconciliación y la cantidad de visas ajustadas.
4. Regresa al Dashboard y revisa julio de 2026.

Las reglas de Firestore son las mismas de la versión 2.9.9. Si ya las publicaste, no es obligatorio volver a desplegarlas para este hotfix.

El ZIP no incluye `node_modules`, `dist` ni `package-lock.json`.
