import { Context, RouterContext, Status } from "../../Dependencies/dependencias.ts";
import { UsuarioModel } from "../../Model/Administrador/UsuarioModel.ts";
import { hashPassword, compararPassword } from "../../Helpers/Password.ts";
import { CrearToken } from "../../Helpers/Jwt.ts";
import {
  registroSchema,
  loginSchema,
  filtroUsuariosSchema,
  cambiarEstadoSchema,
  observacionSchema,
} from "../../Validators/Administrador/UsuarioValidator.ts";

// Valor EXACTO del rol de administrador en la base de datos.
const ROL_ADMIN = "Admin";

// Lee el body como JSON. Si viene vacío o mal formado devuelve null
// (así respondemos 400 en vez de un error 500).
async function leerBody(ctx: Context): Promise<unknown | null> {
  try {
    return await ctx.request.body.json();
  } catch {
    return null;
  }
}

export const UsuarioController = {
  // POST /registro — RF-01 (público, solo Paciente)
  async registrar(ctx: Context) {
    const body = await leerBody(ctx);
    const parsed = registroSchema.safeParse(body);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const existente = await UsuarioModel.buscarPorEmail(parsed.data.email);
    if (existente) {
      ctx.response.status = Status.Conflict;
      ctx.response.body = { ok: false, mensaje: "Ese correo ya está registrado" };
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const usuarioId = await UsuarioModel.crear({
      nombreCompleto: parsed.data.nombreCompleto,
      fechaNacimiento: parsed.data.fechaNacimiento,
      rol: parsed.data.rol,
      email: parsed.data.email,
      passwordHash,
    });

    ctx.response.status = Status.Created;
    ctx.response.body = { ok: true, usuarioId };
  },

  // POST /login — RF-02 (Astro toma este JWT y lo entrega como cookie httpOnly)
  async login(ctx: Context) {
    const body = await leerBody(ctx);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const usuario = await UsuarioModel.buscarPorEmail(parsed.data.email);
    const passwordValida = usuario
      ? await compararPassword(parsed.data.password, usuario.PasswordHash)
      : false;

    // Mensaje genérico: no revela si falló el email o la contraseña (RNF-06)
    if (!usuario || !passwordValida) {
      ctx.response.status = Status.Unauthorized;
      ctx.response.body = { ok: false, mensaje: "Correo o contraseña incorrectos" };
      return;
    }

    if (!usuario.EstadoActivo) {
      ctx.response.status = Status.Forbidden;
      ctx.response.body = { ok: false, mensaje: "Esta cuenta está desactivada" };
      return;
    }

    // El token solo lleva el id (sub). El rol lo consulta requireAuth en la base de datos.
    const token = await CrearToken(String(usuario.UsuarioId));

    ctx.response.status = Status.OK;
    ctx.response.body = {
      ok: true,
      token, // Astro guarda esto como cookie httpOnly, no se expone al navegador
      usuario: {
        usuarioId: usuario.UsuarioId,
        nombreCompleto: usuario.NombreCompleto,
        rol: usuario.Rol,
        email: usuario.Email,
      },
    };
  },

  // GET /usuarios — RF-40, solo Admin. Devuelve { datos, total, pagina, porPagina }.
  async listar(ctx: Context) {
    const params = Object.fromEntries(ctx.request.url.searchParams);
    const parsed = filtroUsuariosSchema.safeParse(params);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const resultado = await UsuarioModel.listar(parsed.data);
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, ...resultado };
  },

  // GET /usuarios/resumen — conteos para el modal "Ver resumen", solo Admin
  async resumen(ctx: Context) {
    const resumen = await UsuarioModel.resumen();
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, resumen };
  },

  // PATCH /usuarios/:id/estado — RF-40, solo Admin.
  // Al desactivar exige un motivo, que queda guardado como observación.
  async cambiarEstado(ctx: RouterContext<"/usuarios/:id/estado">) {
    const { id } = ctx.params;
    const body = await leerBody(ctx);
    const parsed = cambiarEstadoSchema.safeParse(body);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const usuario = await UsuarioModel.buscarPorId(id);
    if (!usuario) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Usuario no encontrado" };
      return;
    }

    // Los administradores no se pueden activar ni desactivar
    if (usuario.Rol === ROL_ADMIN) {
      ctx.response.status = Status.Forbidden;
      ctx.response.body = { ok: false, mensaje: "No se puede cambiar el estado de un administrador" };
      return;
    }

    if (Boolean(usuario.EstadoActivo) === parsed.data.estadoActivo) {
      ctx.response.status = Status.Conflict;
      ctx.response.body = {
        ok: false,
        mensaje: parsed.data.estadoActivo ? "La cuenta ya está activa" : "La cuenta ya está desactivada",
      };
      return;
    }

    const adminId = String(ctx.state.usuario.id);
    const filas = await UsuarioModel.cambiarEstado(
      id,
      parsed.data.estadoActivo,
      adminId,
      parsed.data.motivo ?? "",
    );

    if (filas === 0) {
      ctx.response.status = Status.Conflict;
      ctx.response.body = { ok: false, mensaje: "No se pudo actualizar la cuenta" };
      return;
    }

    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, mensaje: "Estado actualizado" };
  },

  // GET /usuarios/:id/observaciones — historial de un usuario, solo Admin
  async listarObservaciones(ctx: RouterContext<"/usuarios/:id/observaciones">) {
    const { id } = ctx.params;
    const usuario = await UsuarioModel.buscarPorId(id);

    if (!usuario || usuario.Rol === ROL_ADMIN) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Usuario no encontrado" };
      return;
    }

    const observaciones = await UsuarioModel.listarObservaciones(id);
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, observaciones };
  },

  // POST /usuarios/:id/observaciones — agrega una nota al historial, solo Admin
  async agregarObservacion(ctx: RouterContext<"/usuarios/:id/observaciones">) {
    const { id } = ctx.params;
    const body = await leerBody(ctx);
    const parsed = observacionSchema.safeParse(body);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const usuario = await UsuarioModel.buscarPorId(id);
    if (!usuario || usuario.Rol === ROL_ADMIN) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Usuario no encontrado" };
      return;
    }

    const adminId = String(ctx.state.usuario.id);
    const observacionId = await UsuarioModel.agregarObservacion(id, adminId, parsed.data.texto);

    ctx.response.status = Status.Created;
    ctx.response.body = { ok: true, observacionId };
  },

  // GET /usuarios/yo — para que el frontend confirme la sesión activa
  perfilPropio(ctx: Context) {
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, usuario: ctx.state.usuario };
  },
};