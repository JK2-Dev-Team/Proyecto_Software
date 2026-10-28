import { useEffect, useRef } from 'react';

// Usa <dialog> nativo: atrapa el foco y cierra con Escape sin código extra.
export default function Modal({ abierto, titulo, onCerrar, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={titulo}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
    >
      {abierto && (
        <div className="modal-cuerpo">
          <header>
            <h2>{titulo}</h2>
            <button type="button" className="icono" onClick={onCerrar} aria-label="Cerrar">
              ×
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
