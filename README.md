# Sistema de Gestión del Laboratorio Dental Miguel Torres

## 1. Descripción del proyecto

Aplicación web para apoyar la gestión del inventario del Laboratorio Dental Miguel Torres. El módulo desarrollado permite consultar los productos registrados y guardar nuevos productos mediante una API REST conectada a PostgreSQL.

## 2. Objetivo

Aplicar el desarrollo asistido por inteligencia artificial y el protocolo Model Context Protocol (MCP) para construir y organizar un módulo de software utilizando una arquitectura modular, conexión a base de datos y pruebas automatizadas.

## 3. Tecnologías utilizadas

- **Node.js:** entorno de ejecución de JavaScript.
- **Express:** creación del servidor web y de la API REST.
- **PostgreSQL:** sistema gestor de base de datos.
- **pg:** conexión entre Node.js y PostgreSQL.
- **dotenv:** lectura de variables de entorno.
- **Jest:** ejecución de pruebas automatizadas.
- **Supertest:** pruebas de las rutas HTTP.
- **Visual Studio Code:** entorno de desarrollo.
- **Git y GitHub:** control de versiones y revisión de cambios.
- **MCP Filesystem:** acceso controlado a archivos del proyecto desde herramientas compatibles.

## 4. Arquitectura modular

El módulo de inventario utiliza una separación de responsabilidades:

### Controller

Archivo: `src/controllers/inventario.controller.js`

Recibe las solicitudes HTTP, invoca los servicios y devuelve respuestas con códigos de estado y mensajes JSON.

### Service

Archivo: `src/services/inventario.service.js`

Contiene las reglas de negocio y valida el nombre, la cantidad y el precio de los productos antes de registrarlos.

### Repository

Archivo: `src/repositories/inventario.repository.js`

Ejecuta las consultas SQL necesarias para consultar y registrar productos en PostgreSQL mediante consultas parametrizadas.

### Configuración de la base de datos

Archivo: `src/config/database.js`

Configura el grupo de conexiones a PostgreSQL utilizando variables de entorno.

### Flujo de una solicitud

Cliente HTTP → Controller → Service → Repository → PostgreSQL.

La respuesta regresa al cliente a través del Controller.

## 5. Base de datos

Base de datos: `laboratorio_dental`.

Tabla principal: `inventario`.

Campos:

- `id`: identificador del producto.
- `nombre`: nombre del producto.
- `cantidad`: unidades disponibles, con valor mínimo de cero.
- `precio`: precio del producto, con valor mínimo de cero.
- `fecha_creacion`: fecha de registro.

Las credenciales se configuran en un archivo `.env` local. Este archivo no debe publicarse en GitHub.

Variables requeridas:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## 6. Endpoints de la API

| Método | Ruta | Función |
|---|---|---|
| GET | `/` | Verificar el estado del servidor. |
| GET | `/api/inventario` | Consultar los productos del inventario. |
| POST | `/api/inventario` | Registrar un producto nuevo. |

El registro requiere un nombre válido, una cantidad entera mayor o igual a cero y un precio numérico mayor o igual a cero.

## 7. Pruebas automatizadas

Las pruebas se encuentran en `tests/inventario.test.js`.

Se implementaron cuatro casos:

1. Consultar el inventario correctamente.
2. Registrar un producto válido.
3. Rechazar un producto sin nombre.
4. Rechazar una cantidad negativa.

Para ejecutar las pruebas:

```bash
npm test
```

**Importante:** las pruebas actuales eliminan los registros de la tabla `inventario` antes de cada caso. Deben ejecutarse con una base de datos de pruebas separada para evitar borrar información real.

## 8. Configuración de MCP

Se configuró el servidor MCP Filesystem mediante el archivo `.vscode/mcp.json`.

Este servidor permite que una herramienta compatible acceda a los archivos y directorios autorizados del proyecto.

La carpeta autorizada es la raíz local del repositorio. La configuración incluye una ruta específica del equipo donde se desarrolló el taller, por lo que debe ajustarse si se utiliza en otro computador.

### Herramientas MCP utilizadas

Durante la revisión del proyecto se utilizaron herramientas de filesystem para:

- Listar archivos y directorios.
- Explorar la estructura de carpetas.
- Leer el contenido de los archivos fuente.

Los nombres disponibles en la sesión de desarrollo fueron:

- `mcp_secure-filesy_list_directory`
- `mcp_secure-filesy_directory_tree`
- `mcp_secure-filesy_read_text_file`

Estas herramientas ayudaron a inspeccionar la estructura del proyecto y revisar los componentes de la arquitectura modular.

## 9. Prompts utilizados durante el desarrollo

Los prompts se enfocaron en tareas concretas:

**Prompt 1. Inspección del proyecto**

> Inspecciona la estructura del proyecto y revisa los archivos principales del módulo de inventario. Identifica las tecnologías utilizadas y explica cómo se relacionan los componentes.

**Prompt 2. Arquitectura modular**

> Revisa el módulo de inventario y separa las responsabilidades en Controller, Service y Repository, manteniendo la conexión con PostgreSQL y las rutas existentes.

**Prompt 3. Validación de datos**

> Revisa las reglas de validación del servicio de inventario. El nombre debe ser obligatorio, la cantidad debe ser un entero mayor o igual a cero y el precio debe ser un número válido mayor o igual a cero.

**Prompt 4. Pruebas automatizadas**

> Diseña pruebas automatizadas para consultar el inventario, registrar un producto válido y comprobar el rechazo de datos inválidos. Utiliza Jest y Supertest.

**Prompt 5. Revisión mediante MCP**

> Utiliza las herramientas MCP Filesystem disponibles para explorar el proyecto, leer los archivos del módulo de inventario y verificar la separación de responsabilidades entre Controller, Service y Repository.

Estos prompts documentan las instrucciones empleadas como apoyo al desarrollo. Los resultados deben comprobarse revisando el código y ejecutando las pruebas.

## 10. Control de versiones

El código se administra mediante Git y GitHub.

Se trabajó con una rama de funcionalidad para desarrollar el módulo de inventario y un Pull Request dirigido a `develop`. El cambio fue revisado y aprobado antes de fusionarse.

Pull Request del módulo de inventario: `feat(inventario): implementar módulo con PostgreSQL y pruebas`.

## 11. Conclusión

Se desarrolló un módulo de inventario con API REST, conexión a PostgreSQL, validación de datos y pruebas automatizadas. La arquitectura modular facilita el mantenimiento del código, mientras que MCP permite inspeccionar los archivos del proyecto desde herramientas compatibles. GitHub proporciona trazabilidad y revisión colaborativa de los cambios.