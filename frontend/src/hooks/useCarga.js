import { useCallback, useEffect, useState } from 'react';
import { mensajeError } from '../services/api';

// Carga datos al montar y cuando cambian `deps`. `recargar` mantiene los datos visibles mientras actualiza.
export default function useCarga(fn, deps = []) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setDatos(await fn());
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, deps);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { datos, cargando, error, recargar: cargar };
}
