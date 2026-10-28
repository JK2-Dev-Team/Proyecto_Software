export function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {ayuda && <small>{ayuda}</small>}
    </label>
  );
}

export function Aviso({ tipo = 'error', children, onCerrar }) {
  if (!children) return null;
  return (
    <div className={`aviso ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <p>{children}</p>
      {onCerrar && (
        <button type="button" className="icono" onClick={onCerrar} aria-label="Descartar aviso">
          ×
        </button>
      )}
    </div>
  );
}

export function Vacio({ titulo, children }) {
  return (
    <div className="vacio-bloque">
      <h3>{titulo}</h3>
      {children}
    </div>
  );
}
