import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/services';
import { tokenStore } from '../services/api';

const USER_KEY = 'lab_user';
const Ctx = createContext(null);

function usuarioGuardado() {
  try {
    return tokenStore.get() ? JSON.parse(localStorage.getItem(USER_KEY)) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(usuarioGuardado);

  const salir = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUsuario(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:expired', salir);
    return () => window.removeEventListener('auth:expired', salir);
  }, [salir]);

  const entrar = useCallback(async (email, password) => {
    const { token, usuario: datos } = await authService.login(email, password);
    tokenStore.set(token);
    localStorage.setItem(USER_KEY, JSON.stringify(datos));
    setUsuario(datos);
  }, []);

  const valor = useMemo(
    () => ({ usuario, entrar, salir, esAdmin: usuario?.rol === 'admin' }),
    [usuario, entrar, salir]
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);