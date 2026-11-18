# Diciembre contigo

Un calendario de Adviento para regalar. Cada puerta guarda una fotografía y una nota. La última, el 24 de diciembre, celebra la Navidad. La demo incluye 24 notas ficticias y una ilustración de invierno.

![Ilustración de la demo: una cabaña iluminada entre montañas nevadas](public/demo/invierno.svg)

Para ver la portada, las 24 puertas y la carta final, arranca la demo y visita `/`, `/calendario` y `/contenido/24`. Usa la fecha de prueba descrita más abajo para ver la carta.

## Instalación local

Instala Node.js 22 (22.13 o posterior) y Git. En la terminal, clona tu copia del repositorio y entra en la carpeta del proyecto. Ejecuta:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Abre http://127.0.0.1:3000. La configuración inicial es de demostración y funciona sin cuenta de Vercel, sin contraseña y sin fotos personales. Si el puerto está ocupado, usa `PORT=3001 npm run dev`.

La aplicación usa Node.js, HTML renderizado en el servidor, CSS y JavaScript para la cuenta atrás. Usa Vercel Functions y Vercel Blob privado para el despliegue personal, Sharp para las fotografías y la biblioteca qrcode para el QR. No requiere una base de datos.

## Prepara tu calendario

1. Copia `content/calendar.example.json` a `content/calendar.private.json`.
2. Edita `year`, `timezone` y `language`. El ejemplo usa 2026, `Europe/Rome` y `es`. Mantén las 24 entradas en orden del 1 al 24.
3. Escribe un `title` y un `message` para cada día. Una anécdota breve, una frase que os digáis o un plan concreto suelen bastar. Puedes usar `\n` en el JSON para separar párrafos. En `alt`, describe brevemente lo que aporta la foto. Cambia también la carta del día 24.
4. Descarga tus fotos de iCloud y descomprime cualquier ZIP fuera del repositorio. Si una foto HEIC no se convierte en tu equipo, expórtala como JPEG desde Fotos o vuelve a descargarla en un formato compatible.
5. Importa los archivos. Ajusta la ruta al nombre de tu carpeta:

```sh
npm run photos -- import "/ruta/a/las/fotos-descargadas"
```

El comando copia los originales a `private/photos/originals/`. Abre `private/photos/order.json` y deja exactamente 24 nombres distintos, uno por día en orden. El primer nombre corresponde al 1 de diciembre. Si vuelves a importar, se conservan los archivos que ya tienen el mismo nombre y el orden que hayas escrito.

```sh
npm run photos -- prepare
```

Abre `private/photos/review.html` desde tu equipo. Comprueba el orden, las fotos y los textos. La preparación corrige la orientación, genera WebP de hasta 1600 píxeles en el lado mayor y omite EXIF, GPS y otros metadatos de origen. Si necesitas cambios, edita los archivos de autoría, repite `prepare` y revisa otra vez. Cuando estés conforme, registra la aprobación:

```sh
npm run photos -- approve --reviewed
```

La aprobación corresponde al contenido y a las imágenes preparadas de esa revisión. No realiza ninguna conexión de red.

## Configura Vercel y el acceso

1. Importa el repositorio público en Vercel. Selecciona **Other** como preset si se te solicita y conserva la configuración de `vercel.json`. Usa el directorio raíz y Node.js 22.
2. En **Storage**, crea un almacén **Blob** con acceso **Private** y conéctalo al proyecto. Vercel configura `BLOB_READ_WRITE_TOKEN`; guárdalo también en tu `.env.local` para realizar la subida desde tu equipo. Nunca uses un almacén público para estos archivos. [Documentación de Blob privado](https://vercel.com/docs/vercel-blob/private-storage)
3. Crea dos valores aleatorios independientes. Puedes ejecutar `openssl rand -hex 24` para el código y `openssl rand -hex 32` para la clave de sesión. Guarda los valores en el panel de variables de Vercel y, para hacer pruebas locales, en `.env.local`.
4. Define `CALENDAR_MODE=private` en el entorno de producción. Si quieres una demo pública, usa otro proyecto en modo `demo` sin credenciales de almacenamiento. Mantén las vistas previas en demo o configura explícitamente su propio acceso y almacén.

| Variable | Uso |
| --- | --- |
| `CALENDAR_MODE` | `demo` por defecto o `private` con autenticación. |
| `ACCESS_CODE` | Código compartido, de 12 a 256 caracteres. Utiliza un valor aleatorio. |
| `SESSION_SECRET` | Clave de firma de al menos 32 caracteres. |
| `BLOB_READ_WRITE_TOKEN` | Credencial del almacén privado, solo para servidor y subida local. |
| `BLOB_CALENDAR_PATH` | Ruta opcional del manifiesto. Por defecto, `calendar/manifest.json`. Usa la misma ruta en local y Vercel. |
| `CALENDAR_LANGUAGE` | Idioma de la pantalla de acceso antes de abrir el manifiesto privado. El resto usa `language` del manifiesto. |
| `LOCAL_PRIVATE_FILES` | Con `1`, el servidor de desarrollo lee los archivos locales en modo privado. |
| `LOCAL_PREVIEW_AT` | Fecha ISO con desfase, solo para el servidor de desarrollo. |

## Sube la revisión aprobada y despliega

Con el token correcto en `.env.local`, ejecuta este comando únicamente cuando quieras subir tu revisión al almacén:

```sh
npm run photos -- publish --confirm-upload
```

La subida guarda las 24 imágenes en una carpeta versionada y activa el manifiesto privado después. Una revisión modificada requiere otra aprobación. Si se interrumpe la subida, puedes repetir el comando con el mismo contenido aprobado. Las revisiones previas pueden seguir en Blob. Para recuperar espacio, revisa qué manifiesto está activo antes de eliminar versiones antiguas desde el panel.

Despliega desde Vercel después de configurar las variables. Los cambios de variables requieren un nuevo despliegue. Para actualizar solo las fotos o notas, vuelve a preparar, aprobar y subir la revisión. Los cambios del manifiesto pueden tardar alrededor de un minuto en verse. El servidor lee el manifiesto de Blob durante las peticiones autenticadas, así que la compilación de Vercel puede hacerse desde un clon limpio.

Antes de compartir la URL, comprueba en una ventana privada que aparece el formulario de acceso, que `/calendario` vuelve a la portada y que `/foto/24` exige sesión. Entra con el código y confirma que las puertas futuras siguen cerradas. Comparte el código por separado.

## Código QR

```sh
npm run qr -- https://tu-calendario.vercel.app/
```

Imprime o envía `private/qr.png`. El QR lleva a la pantalla de acceso. Conserva cualquier contraseña fuera de la URL y del QR.

## Fechas y pruebas

El servidor abre cada puerta al comenzar su fecha local en la zona IANA configurada. En Roma, el día 1 de diciembre de 2026 abre a las 00:00 CET, a las 23:00 UTC del 30 de noviembre. Las puertas abiertas siguen disponibles incluso después de Navidad. El navegador muestra la cuenta atrás y el servidor comprueba la fecha al solicitar cada mensaje o foto.

```sh
npm test
npm run build
LOCAL_PREVIEW_AT=2026-12-24T12:00:00+01:00 npm run dev
```

Visita `/calendario` para abrir los 24 días. Prueba también con `2026-12-01T00:00:00+01:00`, cuando solo abre el primero. Para probar tus archivos locales, usa `CALENDAR_MODE=private`, `LOCAL_PRIVATE_FILES=1`, un código y una clave de sesión en `.env.local`. Primero ejecuta `prepare`. El directorio `dist/` contiene solo el CSS, el script de cuenta atrás, la ilustración y el archivo robots. Las páginas las sirve la función.

## Personalización

Edita las variables de color, la tipografía y la cuadrícula en `src/client/style.css`. Los días destacados se eligen en `src/calendar.mjs`. Para traducir la interfaz, añade un catálogo completo siguiendo `es` en `src/i18n.mjs`, cambia `language` en el JSON y configura `CALENDAR_LANGUAGE` para la pantalla de acceso. Escribe también los títulos, mensajes y textos alternativos en ese idioma. Si cambias o añades una ilustración pública, actualiza la lista de archivos en `scripts/assets.mjs` y la lista de rutas permitidas en `scripts/guard.mjs`.

## Git y privacidad

Un repositorio público solo es adecuado si dejas fuera los archivos personales y las credenciales y proteges su entrega en la aplicación. `src/`, `content/calendar.example.json` y `public/demo/` pueden compartirse. Mantén los originales, los WebP, las revisiones y el QR bajo `private/`, los textos personales en `content/calendar.private.json` y los secretos en `.env.local`. Evita incluir copias temporales y datos personales en documentación, capturas, fixtures, artefactos o Git LFS.

Activa el control de archivos después de clonar:

```sh
git config --local core.hooksPath .githooks
git add .
npm run guard
git diff --cached --stat
```

El hook y el comando validan rutas, tipos de archivo y algunas firmas de secretos en el índice. Revisa el contenido del diff antes de confirmar cambios. Las comprobaciones automáticas no pueden identificar una nota personal pegada en un archivo público permitido.

Si hubo una filtración, considera el material expuesto. Revoca y rota las credenciales de inmediato. Coordina la limpieza con quienes tengan clones o ramas, trabaja desde un clon aparte y usa `git filter-repo` para eliminar los archivos de todas las referencias afectadas. Verifica el historial reescrito antes de actualizar las referencias remotas mediante un push forzado coordinado. Pide a los colaboradores que vuelvan a clonar para evitar que reintroduzcan el historial. Revisa forks, solicitudes de cambios, cachés y artefactos, y solicita asistencia a GitHub si corresponde. Añadir una ruta al ignore solo protege contra nuevos añadidos accidentales. [Guía de GitHub sobre datos confidenciales](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

En producción la cookie es `Secure`, `HttpOnly`, `SameSite=Strict` y válida durante siete días. Rotar el código o la clave invalida las sesiones. La app limita a ocho intentos en diez minutos por IP y por instancia. En Vercel las instancias pueden reiniciarse o escalar de forma independiente. Puedes añadir una regla de límite en Vercel Firewall si necesitas un límite compartido, incluyendo la ruta directa `/api/calendar` para POST. Las respuestas privadas usan `no-store`. Las reglas de indexación solo orientan a rastreadores. Las personas con acceso pueden guardar una copia de lo que ven.

## Problemas frecuentes

- **Solo veo puertas cerradas.** Revisa el año, la zona horaria y la fecha de prueba.
- **La foto no se convierte.** Exporta un JPEG nuevo y actualiza el nombre en `order.json`.
- **La revisión cambió.** Ejecuta `prepare`, abre de nuevo la vista de revisión y vuelve a aprobar.
- **El sitio no carga en modo privado.** Comprueba las variables, el alcance del token y que el manifiesto se haya subido a la ruta correcta.
- **La subida funciona pero la foto no se ve.** Comprueba si ese día está abierto y espera a que se propague el manifiesto.
- **El acceso devuelve un error.** Usa la URL principal del sitio de forma consistente y accede en producción por HTTPS.
- **El control de Git rechaza un archivo.** Revisa su ubicación. Si es privado y lo añadiste al índice, quítalo del índice y conserva tu copia local.

Código bajo licencia MIT. Los contenidos de ejemplo son ficticios. Las fotografías que añadas conservan sus propios derechos.
