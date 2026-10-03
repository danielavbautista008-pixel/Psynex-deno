// Helpers/Archivos.ts
// Validación y guardado de los documentos que suben psicólogos y empresas.
// Se guardan en ./uploads (carpeta del servidor, NO pública).

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por archivo
export const DIR_UPLOADS = "./uploads";

// Firmas (primeros bytes) de los formatos permitidos. El tipo que declara el
// navegador (file.type) y la extensión se pueden falsificar; los primeros
// bytes del archivo no, así que validamos con ellos.
const FIRMAS: { ext: string; mime: string; bytes: number[] }[] = [
  { ext: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

export interface ArchivoValido {
  ext: string;
  mime: string;
}

export type ResultadoArchivo =
  | { ok: true; valor: ArchivoValido }
  | { ok: false; error: string };

export const validarArchivo = async (
  archivo: File,
  etiqueta: string,
): Promise<ResultadoArchivo> => {
  if (archivo.size === 0) return { ok: false, error: `${etiqueta}: el archivo está vacío` };
  if (archivo.size > MAX_BYTES) return { ok: false, error: `${etiqueta}: supera los 5 MB` };

  const cabecera = new Uint8Array(await archivo.slice(0, 8).arrayBuffer());
  const firma = FIRMAS.find((f) => f.bytes.every((b, i) => cabecera[i] === b));
  if (!firma) {
    return { ok: false, error: `${etiqueta}: formato no permitido (solo PDF, JPG o PNG)` };
  }
  return { ok: true, valor: { ext: firma.ext, mime: firma.mime } };
};

// Guarda el archivo con un nombre generado por el servidor (nunca el del
// usuario) y devuelve la ruta. carpeta y usuarioId los pone el servidor.
export const guardarArchivo = async (
  carpeta: string,
  usuarioId: string,
  archivo: File,
  ext: string,
): Promise<string> => {
  const dir = `${DIR_UPLOADS}/${carpeta}/${usuarioId}`;
  await Deno.mkdir(dir, { recursive: true });
  const ruta = `${dir}/${crypto.randomUUID()}.${ext}`;
  await Deno.writeFile(ruta, new Uint8Array(await archivo.arrayBuffer()));
  return ruta;
};

// Si el registro falla a mitad de camino, se limpia lo que ya se había guardado.
export const borrarCarpetaUsuario = async (carpeta: string, usuarioId: string) => {
  await Deno.remove(`${DIR_UPLOADS}/${carpeta}/${usuarioId}`, { recursive: true }).catch(() => {});
};

// Nombre original solo para mostrarlo al admin (no se usa como ruta).
export const nombreSeguro = (nombre: string): string =>
  nombre.replace(/[^\p{L}\p{N}.\- _()]/gu, "_").slice(0, 150) || "documento";

