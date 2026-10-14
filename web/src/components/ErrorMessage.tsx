import { ApiError } from "../api.ts";

interface Props {
  error: unknown;
}

// Muestra un error de la API (con sus detalles, si los hay)
export default function ErrorMessage({ error }: Props) {
  if (!error) return null;

  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  const details = error instanceof ApiError ? error.details : [];

  return (
    <div className="alert alert-error" role="alert">
      <p>{message}</p>
      {details.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
