import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { inventarioService } from '../services/services';

const ENLACES = [
  { a: '/ordenes', texto: 'Órdenes de trabajo' },
  { a: '/citas', texto: 'Citas' },
  { a: '/inventario', texto: 'Inventario', conAlertas: true },
  { a: '/clientes', texto: 'Clientes' },
];

export default function Layout() {
  const { usuario, salir } = useAuth();
  const { pathname } = useLocation();
  const [alertas, setAlertas] = useState(0);

  // El conteo se refresca al cambiar de sección.
  useEffect(() => {
    let vivo = true;
    inventarioService
      .alertas()
      .then((a) => vivo && setAlertas(a.length))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [pathname]);

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <strong>Laboratorio Dental</strong>
          <span>Miguel Torres</span>
        </div>
        <nav aria-label="Secciones">
          {ENLACES.map((e) => (
            <NavLink key={e.a} to={e.a}>
              {e.texto}
              {e.conAlertas && alertas > 0 && (
                <span className="pastilla" aria-label={`${alertas} insumos con stock bajo`}>
                  {alertas}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sesion">
          <span>{usuario?.nombre || usuario?.email}</span>
          <small>{usuario?.rol === 'admin' ? 'Administrador' : 'Recepción'}</small>
          <button type="button" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
