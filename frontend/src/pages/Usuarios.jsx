import { useEffect, useState } from 'react';
import useCarga from '../hooks/useCarga';
import Modal from '../components/Modal';
import { Aviso, Campo, Vacio } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usuariosService } from '../services/services';
import { mensajeError } from '../services/api';

const ROLES = [
  { id: 'recepcionista', texto: 'Recepción' },
  { id: 'admin', texto: 'Administrador' },
];
// created_at es una marca de tiempo (no una columna DATE): se muestra en la hora local del navegador.
const fechaCreacion = (v) => new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const textoRol = (id) => ROLES.find((r) => r.id === id)?.texto ?? id;

export default function Usuarios() {
  const { usuario: yo, esAdmin } = useAuth();
  const { datos, cargando, error, recargar } = useCarga(() => usuariosService.listar(), []);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [clave, setClave] = useState(null);
  const [errorAccion, setErrorAccion] = useState('');
  const [ocupado, setOcupado] = useState(null); // id del usuario mientras se activa o desactiva

  // La API ya rechaza a quien no es administrador; esto evita mostrar una pantalla que no puede usar.
  if (!esAdmin) {
    return (
      <>
        <div className="cabecera-pagina"><h1>Usuarios</h1></div>
        <Aviso tipo="alerta">Solo el administrador puede gestionar usuarios.</Aviso>
      </>
    );
  }

  async function cambiarActivo(u) {
    setErrorAccion('');
    setOcupado(u.id);
    try {
      await usuariosService.actualizar(u.id, { activo: !u.activo });
      await recargar();
    } catch (err) {
      setErrorAccion(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <h1>Usuarios</h1>
        <button className="boton" onClick={() => setCreando(true)}>Nuevo usuario</button>
      </div>

      {error && <Aviso>{error}</Aviso>}
      <Aviso onCerrar={() => setErrorAccion('')}>{errorAccion}</Aviso>

      {cargando && !datos && <p className="suave">Cargando usuarios…</p>}
      {datos && datos.length === 0 && <Vacio titulo="Aún no hay usuarios registrados" />}

      {datos && datos.length > 0 && (
        <div className="tabla-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th><span className="oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((u) => {
                const esYo = u.id === yo?.id;
                return (
                  <tr key={u.id} className={u.activo ? '' : 'usuario-inactivo'}>
                    <td>{u.nombre}{esYo && <span className="suave"> (tú)</span>}</td>
                    <td>{u.email}</td>
                    <td>{textoRol(u.rol)}</td>
                    <td><span className={u.activo ? 'marca-estado ok' : 'marca-estado'}>{u.activo ? 'Activo' : 'Desactivado'}</span></td>
                    <td>{fechaCreacion(u.created_at)}</td>
                    <td className="acciones">
                      <button className="boton chico secundario" onClick={() => setEditando(u)}>Editar</button>
                      <button className="boton chico secundario" onClick={() => setClave(u)}>Contraseña</button>
                      {!esYo && (
                        <button
                          className={u.activo ? 'boton chico texto' : 'boton chico secundario'}
                          disabled={ocupado === u.id}
                          onClick={() => cambiarActivo(u)}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NuevoUsuario abierto={creando} onCerrar={() => setCreando(false)} onListo={async () => { setCreando(false); await recargar(); }} />
      <EditarUsuario usuario={editando} esYo={editando?.id === yo?.id} onCerrar={() => setEditando(null)} onListo={async () => { setEditando(null); await recargar(); }} />
      <RestablecerClave usuario={clave} onCerrar={() => setClave(null)} onListo={() => setClave(null)} />
    </>
  );
}

function NuevoUsuario({ abierto, onCerrar, onListo }) {
  const vacio = { nombre: '', email: '', password: '', rol: 'recepcionista' };
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  useEffect(() => { if (abierto) { setForm(vacio); setError(''); } }, [abierto]); // eslint-disable-line

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await usuariosService.crear(form);
      await onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nuevo usuario" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Nombre"><input value={form.nombre} onChange={set('nombre')} maxLength={120} required /></Campo>
        <Campo etiqueta="Correo electrónico"><input type="email" value={form.email} onChange={set('email')} maxLength={150} required /></Campo>
        <Campo etiqueta="Contraseña inicial" ayuda="Mínimo 8 caracteres. Entrégasela a la persona; podrás cambiarla cuando quieras.">
          <input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={form.password} onChange={set('password')} required />
        </Campo>
        <Campo etiqueta="Rol">
          <select value={form.rol} onChange={set('rol')}>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.texto}</option>)}
          </select>
        </Campo>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Crear usuario'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditarUsuario({ usuario, esYo, onCerrar, onListo }) {
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('recepcionista');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) { setNombre(usuario.nombre); setRol(usuario.rol); setError(''); }
  }, [usuario]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await usuariosService.actualizar(usuario.id, { nombre, rol });
      await onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={Boolean(usuario)} titulo={usuario ? `Editar a ${usuario.nombre}` : ''} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} required /></Campo>
        <Campo etiqueta="Rol" ayuda={esYo ? 'No puedes cambiar tu propio rol.' : undefined}>
          <select value={rol} onChange={(e) => setRol(e.target.value)} disabled={esYo}>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.texto}</option>)}
          </select>
        </Campo>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </Modal>
  );
}

function RestablecerClave({ usuario, onCerrar, onListo }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { if (usuario) { setPassword(''); setError(''); } }, [usuario]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await usuariosService.restablecerPassword(usuario.id, password);
      onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal abierto={Boolean(usuario)} titulo={usuario ? `Nueva contraseña para ${usuario.nombre}` : ''} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Nueva contraseña" ayuda="Mínimo 8 caracteres. La contraseña anterior deja de servir de inmediato.">
          <input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Campo>
        <div className="pie-modal">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </div>
      </form>
    </Modal>
  );
}
