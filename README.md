# Inscripción — Presentación de la paleta

La gente escanea el QR del club → elige día y horario → se reserva el lugar → botón para unirse al grupo de WhatsApp de su turno.

- 3 fines de semana × viernes, sábado y domingo × 19, 20 y 21 h = **27 turnos de 30 personas = 810 lugares**.
- Cada inscripto deja **nombre, celular y cuántos vienen con él** (hasta 3 más: un equipo completo). Cada persona ocupa un lugar.
- Los cupos se cuentan en MySQL (Hostinger). La reserva es un único `UPDATE ... WHERE ocupados + personas <= 30`, así que nunca pasa de 30 aunque se anoten 50 a la vez.
- Cada reserva tiene un código secreto guardado en ese celular: si vuelve a escanear, ve su grupo directamente (no cuenta dos veces). Sólo con ese código se puede **cambiar de horario** o **desinscribirse**, y eso libera los lugares.
- Las bajas no se borran de la base: quedan con fecha en `cancelada`, por si acaso.
- Los turnos que ya empezaron se ocultan solos.
- `admin.html` → con clave: inscriptos por turno (nombre, celular, acompañantes) y descarga a Excel.

## Archivos (todo lo de `public/` se sube a Hostinger)

| Archivo | Qué es |
|---|---|
| `config.js` | Fechas, horarios, cupo, links de WhatsApp |
| `api-config.php` | Datos de la base MySQL (+ cupo y horas, iguales a `config.js`). **No va a git**: si no está, copiarlo de `api-config.example.php` |
| `api.php` | Cupos, reservas, cambios, bajas y lista de inscriptos. Crea las tablas `turnos` y `reservas` solas |
| `index.html` · `app.js` · `styles.css` · `store.js` | La página que abre el QR |
| `admin.html` | Inscriptos por turno + descarga CSV (pide `admin_clave`) |
| `.htaccess` | Bloquea el acceso a `api-config.php` |

## Probar en la compu (modo demo)

En `localhost` corre sin servidor ni base: los cupos se guardan en el navegador.

```bash
python -m http.server 5173 --directory public
```

Abrir http://localhost:5173 y http://localhost:5173/admin.html

## Subir a Hostinger (una sola vez)

1. **Base de datos**: hPanel → *Bases de datos → Administración* → crear base + usuario. Anotar nombre, usuario y clave (Hostinger les antepone `u123456789_`).
2. **Completar** `public/api-config.php` con esos datos y una `admin_clave` (la que usa Francisco para ver los inscriptos), y `public/config.js` con las fechas de los 3 viernes y los links de WhatsApp.
3. **Subir** el repo a `public_html/` (despliegue Git de Hostinger o Administrador de archivos). El `.htaccess` de la raíz manda todo a `public/`. `api-config.php` no está en git: subirlo a mano a `public_html/public/`.
4. **Probar**: abrir `https://tudominio.com/api.php` → tiene que mostrar `{"ocupados":{}}`. Si dice `{"error":"db"}`, revisar los datos de `api-config.php`.
5. Verificar que `https://tudominio.com/api-config.php` dé **403** (prohibido).

`https://tudominio.com/` **es el link que va en el QR.** Inscriptos: `https://tudominio.com/admin.html` (pide la `admin_clave`).

## Grupos de WhatsApp

- Un grupo por turno (27): cargar cada link en `LINKS` con la clave `'AAAA-MM-DD-HHMM'`.
- Un grupo por día (9) o uno solo: usar `LINK_POR_DEFECTO` y/o repetir el mismo link.
- En cada grupo conviene activar *"Aprobar nuevos participantes"* para que el link no se viralice fuera del club.

## Antes del evento

- **Probar** desde 2–3 celulares distintos: anotarse, cambiar de turno, ver `admin.html`.
- **Resetear** las pruebas: hPanel → phpMyAdmin → *Vaciar* las tablas `turnos` **y** `reservas` (las dos juntas, si no los números no cierran).
- **No cambiar** fechas u horarios que ya tengan anotados (el contador se guarda por fecha + hora). Agregar un finde nuevo sí se puede.
- Para corregir a mano: phpMyAdmin. `turnos.ocupados` es la cantidad de personas por turno; `reservas` tiene quién se anotó.

## Límites a saber

- El contador cuenta quién **reservó** en la página, no quién entró realmente al grupo (WhatsApp no lo expone).
- Alguien que borre los datos del navegador o use otro celular podría anotarse dos veces. Se ve en `admin.html` (mismo nombre o celular) y se puede dar de baja a mano en phpMyAdmin: poner fecha en `cancelada` y restar sus `personas` en `turnos`.
- Si alguien pierde su celular o borra los datos, no puede cambiar ni darse de baja solo: lo hace la organización a mano.
