import type { RouterContext } from "../Dependencies/dependencias.ts";
import { hash, compare } from "../Dependencies/dependencias.ts";
import {
    registroSchema,
    loginSchema,
    solicitarRecuperacionSchema,
    restablecerPasswordSchema,
} from "../Validators/AuthValidator.ts";
import { buscarPorEmail, buscarPorId, crearUsuario, sinPassword } from "../Model/UsuarioModel.ts";
import { EmailService } from "../Helpers/EmailService.ts";
import { CrearToken } from "../Helpers/Jwt.ts";
import {
    crearTokenRecuperacion,
    huellaPassword,
    leerTokenRecuperacion,
    MINUTOS_RECUPERACION,
} from "../Helpers/RecuperarToken.ts";
import { psicologoSchema, DOCS_PSICOLOGO, empresaSchema, DOCS_EMPRESA } from "../Validators/RegistroValidator.ts";
import {
    validarArchivo,
    guardarArchivo,
    borrarCarpetaUsuario,
    nombreSeguro,
} from "../Helpers/Archivos.ts";
import { RegistroModel, type DocumentoGuardado } from "../Model/RegistroModel.ts";
import { conexion } from "../Model/conexion.ts";

// Guarda el token en una cookie segura
const ponerCookie = async (ctx: RouterContext<string>, userId: string) => {
    const token = await CrearToken(userId);
    await ctx.cookies.set("token", token, {
        httpOnly: true,   // JavaScript del navegador no puede leerla
        sameSite: "lax",  // protege contra peticiones desde otros sitios
        maxAge: 60 * 60,  // dura 1 hora (en segundos), igual que el exp del token
        path: "/",
    });
};

export const registrar = async (ctx: RouterContext<string>) => {
    const body = await ctx.request.body.json().catch(() => null);
    const validacion = registroSchema.safeParse(body);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const datos = validacion.data;

    if (await buscarPorEmail(datos.email)) {
        ctx.response.status = 409;
        ctx.response.body = { error: "Ese email ya está registrado" };
        return;
    }

    const id = await crearUsuario({
        nombreCompleto: datos.nombreCompleto,
        fechaNacimiento: datos.fechaNacimiento,
        rol: datos.rol,
        email: datos.email,
        passwordHash: await hash(datos.password),
    });

    // El paciente necesita su fila en perfilpaciente para agendar citas
    // y guardar resultados. Si fallara, se borra el usuario para no dejarlo a medias.
    if (datos.rol === "Paciente") {
        try {
            await RegistroModel.crearPerfilPaciente(id);
        } catch (error) {
            console.error("No se pudo crear el perfil del paciente:", error);
            await conexion.execute(`DELETE FROM usuarios WHERE UsuarioId = ?`, [id]).catch(() => {});
            ctx.response.status = 500;
            ctx.response.body = { error: "No se pudo completar el registro" };
            return;
        }
    }

    // Envío del correo de bienvenida en segundo plano
    EmailService.enviarBienvenida({
        to: datos.email,
        nombreCompleto: datos.nombreCompleto,
        rol: datos.rol,
    }).catch((err) => console.error("Error al enviar email de bienvenida:", err));

    await ponerCookie(ctx, id);
    ctx.response.status = 201;
    ctx.response.body = { mensaje: "Usuario creado", usuarioId: id };
};

export const login = async (ctx: RouterContext<string>) => {
    const body = await ctx.request.body.json().catch(() => null);
    const validacion = loginSchema.safeParse(body);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const { email, password } = validacion.data;

    const usuario = await buscarPorEmail(email);
    if (!usuario || usuario.EstadoActivo !== 1 || !(await compare(password, usuario.PasswordHash))) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Credenciales incorrectas" };
        return;
    }

    await ponerCookie(ctx, usuario.UsuarioId);
    ctx.response.body = { mensaje: "Sesión iniciada", usuario: sinPassword(usuario) };
};

export const logout = async (ctx: RouterContext<string>) => {  //logout: Elimina la cookie del token enviando la orden al navegador.
    await ctx.cookies.delete("token");
    ctx.response.body = { mensaje: "Sesión cerrada" };
};

export const perfil = async (ctx: RouterContext<string>) => {
    const usuario = await buscarPorId(ctx.state.usuarioId);
    if (!usuario) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Usuario no encontrado" };
        return;
    }
    ctx.response.body = { usuario: sinPassword(usuario) };
};

// POST /api/auth/registro/psicologo — registro de psicólogo con documentos.
// Llega como multipart/form-data: los datos del formulario + los archivos
// tarjetaProfesional, cedula, diploma y certificadoVigencia (PDF, JPG o PNG, máx. 5 MB).
// La cuenta queda creada pero SIN verificar hasta que el admin la apruebe.
export const registrarPsicologo = async (ctx: RouterContext<string>) => {
    if (ctx.request.body.type() !== "form-data") {
        ctx.response.status = 400;
        ctx.response.body = { error: "El registro de psicólogo debe enviarse como multipart/form-data" };
        return;
    }

    let form: FormData;
    try {
        form = await ctx.request.body.formData();
    } catch {
        ctx.response.status = 400;
        ctx.response.body = { error: "No se pudo leer el formulario" };
        return;
    }

    // 1. Validar los campos de texto
    const campos: Record<string, string> = {};
    for (const [clave, valor] of form.entries()) {
        if (typeof valor === "string") campos[clave] = valor;
    }
    const validacion = psicologoSchema.safeParse(campos);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const datos = validacion.data;

    if (await buscarPorEmail(datos.email)) {
        ctx.response.status = 409;
        ctx.response.body = { error: "Ese email ya está registrado" };
        return;
    }

    // 2. Validar los documentos ANTES de guardar nada
    const errores: string[] = [];
    const archivos: { campo: string; tipo: string; archivo: File; ext: string; mime: string }[] = [];
    for (const doc of DOCS_PSICOLOGO) {
        const archivo = form.get(doc.campo);
        if (!(archivo instanceof File) || archivo.size === 0) {
            if (doc.obligatorio) errores.push(`${doc.etiqueta}: es obligatorio`);
            continue;
        }
        const resultado = await validarArchivo(archivo, doc.etiqueta);
        if (!resultado.ok) {
            errores.push(resultado.error);
            continue;
        }
        archivos.push({ campo: doc.campo, tipo: doc.tipo, archivo, ...resultado.valor });
    }
    if (errores.length) {
        ctx.response.status = 400;
        ctx.response.body = { error: errores };
        return;
    }

    // 3. Guardar archivos y luego crear todo en la base de datos.
    //    Si la base de datos falla, se borran los archivos ya guardados.
    const usuarioId = crypto.randomUUID();
    try {
        const documentos: DocumentoGuardado[] = [];
        for (const a of archivos) {
            const ruta = await guardarArchivo("psicologos", usuarioId, a.archivo, a.ext);
            documentos.push({
                tipo: a.tipo,
                nombreOriginal: nombreSeguro(a.archivo.name),
                ruta,
                mime: a.mime,
                bytes: a.archivo.size,
            });
        }

        await RegistroModel.crearPsicologo({
            usuarioId,
            nombreCompleto: datos.nombreCompleto,
            email: datos.email,
            passwordHash: await hash(datos.password),
            fechaNacimiento: datos.fechaNacimiento,
            numeroDocumento: datos.numeroDocumento,
            documentos,
        });
    } catch (error) {
        console.error("Error al registrar psicólogo:", error);
        await borrarCarpetaUsuario("psicologos", usuarioId);
        ctx.response.status = 500;
        ctx.response.body = { error: "No se pudo completar el registro" };
        return;
    }

    EmailService.enviarBienvenida({
        to: datos.email,
        nombreCompleto: datos.nombreCompleto,
        rol: "Psicologo",
    }).catch((err) => console.error("Error al enviar email de bienvenida:", err));

    await ponerCookie(ctx, usuarioId);
    ctx.response.status = 201;
    ctx.response.body = {
        mensaje: "Registro recibido. Tu cuenta será verificada por el equipo de Psynex.",
        usuarioId,
    };
};

// POST /api/auth/registro/empresa — registro de empresa con sus documentos.
// Llega como multipart/form-data: nombreEmpresa, nit, email, telefono, sector,
// cantidadEmpleados, password + archivos rut (obligatorio) y camaraComercio
// (opcional): PDF, JPG o PNG de máximo 5 MB.
// La empresa queda SIN verificar hasta que el admin la apruebe.
export const registrarEmpresa = async (ctx: RouterContext<string>) => {
    if (ctx.request.body.type() !== "form-data") {
        ctx.response.status = 400;
        ctx.response.body = { error: "El registro de empresa debe enviarse como multipart/form-data" };
        return;
    }

    let form: FormData;
    try {
        form = await ctx.request.body.formData();
    } catch {
        ctx.response.status = 400;
        ctx.response.body = { error: "No se pudo leer el formulario" };
        return;
    }

    // 1. Validar los campos de texto
    const campos: Record<string, string> = {};
    for (const [clave, valor] of form.entries()) {
        if (typeof valor === "string") campos[clave] = valor;
    }
    const validacion = empresaSchema.safeParse(campos);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const datos = validacion.data;

    if (await buscarPorEmail(datos.email)) {
        ctx.response.status = 409;
        ctx.response.body = { error: "Ese email ya está registrado" };
        return;
    }

    // 2. Validar los documentos ANTES de guardar nada
    const errores: string[] = [];
    const archivos: { tipo: string; archivo: File; ext: string; mime: string }[] = [];
    for (const doc of DOCS_EMPRESA) {
        const archivo = form.get(doc.campo);
        if (!(archivo instanceof File) || archivo.size === 0) {
            if (doc.obligatorio) errores.push(`${doc.etiqueta}: es obligatorio`);
            continue;
        }
        const resultado = await validarArchivo(archivo, doc.etiqueta);
        if (!resultado.ok) {
            errores.push(resultado.error);
            continue;
        }
        archivos.push({ tipo: doc.tipo, archivo, ...resultado.valor });
    }
    if (errores.length) {
        ctx.response.status = 400;
        ctx.response.body = { error: errores };
        return;
    }

    // 3. Guardar archivos y luego crear todo en la base de datos.
    //    Si la base de datos falla, se borran los archivos ya guardados.
    const usuarioId = crypto.randomUUID();
    try {
        const documentos: DocumentoGuardado[] = [];
        for (const a of archivos) {
            const ruta = await guardarArchivo("empresas", usuarioId, a.archivo, a.ext);
            documentos.push({
                tipo: a.tipo,
                nombreOriginal: nombreSeguro(a.archivo.name),
                ruta,
                mime: a.mime,
                bytes: a.archivo.size,
            });
        }

        await RegistroModel.crearEmpresa({
            usuarioId,
            nombreEmpresa: datos.nombreEmpresa,
            nit: datos.nit,
            email: datos.email,
            telefono: datos.telefono,
            sector: datos.sector ?? "",
            cantidadEmpleados: datos.cantidadEmpleados ?? null,
            passwordHash: await hash(datos.password),
            documentos,
        });
    } catch (error) {
        console.error("Error al registrar empresa:", error);
        await borrarCarpetaUsuario("empresas", usuarioId);
        ctx.response.status = 500;
        ctx.response.body = { error: "No se pudo completar el registro" };
        return;
    }

    EmailService.enviarBienvenida({
        to: datos.email,
        nombreCompleto: datos.nombreEmpresa,
        rol: "Empresa",
    }).catch((err) => console.error("Error al enviar email de bienvenida:", err));

    await ponerCookie(ctx, usuarioId);
    ctx.response.status = 201;
    ctx.response.body = {
        mensaje: "Registro recibido. La empresa será verificada por el equipo de Psynex.",
        usuarioId,
    };
};


// =====================================================================
// RECUPERAR CONTRASEÑA
// 1. POST /api/auth/recuperar            { email }  -> envía el correo
// 2. GET  /api/auth/recuperar/validar?token=...     -> ¿el enlace sirve?
// 3. POST /api/auth/restablecer          { token, password } -> la cambia
// =====================================================================

// Límite de intentos (en memoria): evita que se envíen muchos correos
const intentos = new Map<string, number[]>();
const VENTANA_MS = 15 * 60 * 1000;

const superaLimite = (clave: string, maximo: number) => {
    const ahora = Date.now();
    const recientes = (intentos.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);
    recientes.push(ahora);
    intentos.set(clave, recientes);
    return recientes.length > maximo;
};

// Mismo mensaje exista o no el correo, para no revelar quién tiene cuenta
const MENSAJE_ENVIADO =
    "Si el correo está registrado en Psynex, te enviamos un enlace para cambiar tu contraseña.";

export const solicitarRecuperacion = async (ctx: RouterContext<string>) => {
    const body = await ctx.request.body.json().catch(() => null);
    const validacion = solicitarRecuperacionSchema.safeParse(body);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const { email } = validacion.data;

    if (superaLimite(`ip:${ctx.request.ip}`, 10) || superaLimite(`email:${email}`, 3)) {
        ctx.response.status = 429;
        ctx.response.body = { error: "Hiciste varias solicitudes seguidas. Espera unos minutos e inténtalo de nuevo." };
        return;
    }

    const usuario = await buscarPorEmail(email);
    if (usuario && usuario.EstadoActivo === 1) {
        const token = await crearTokenRecuperacion(usuario.UsuarioId, usuario.PasswordHash);
        const frontend = Deno.env.get("FRONTEND_URL") ?? "http://localhost:4321";
        // El correo se envía sin esperar, así la respuesta tarda lo mismo exista o no la cuenta
        EmailService.enviarRecuperacionPassword({
            to: usuario.Email,
            nombre: usuario.NombreCompleto,
            enlaceRecuperacion: `${frontend}/recuperar?token=${encodeURIComponent(token)}`,
            minutos: MINUTOS_RECUPERACION,
        }).catch((e) => console.error("Correo de recuperación:", e));
    }

    ctx.response.body = { ok: true, mensaje: MENSAJE_ENVIADO };
};

// Revisa el token y devuelve el usuario si todo está bien
const usuarioDelToken = async (token: string) => {
    const datos = await leerTokenRecuperacion(token);
    if (!datos) return null;
    const usuario = await buscarPorId(datos.usuarioId);
    if (!usuario || usuario.EstadoActivo !== 1) return null;
    // Si ya cambió la contraseña con este enlace (u otro), la huella no coincide
    if ((await huellaPassword(usuario.PasswordHash)) !== datos.huella) return null;
    return usuario;
};

// Correo con la mitad oculta: va****@gmail.com
const ocultarCorreo = (email: string) => {
    const [nombre, dominio] = email.split("@");
    if (!dominio) return email;
    return `${nombre.slice(0, 2)}${"*".repeat(Math.max(2, nombre.length - 2))}@${dominio}`;
};

export const validarRecuperacion = async (ctx: RouterContext<string>) => {
    const token = ctx.request.url.searchParams.get("token") ?? "";
    const usuario = token.length >= 20 ? await usuarioDelToken(token) : null;
    if (!usuario) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Este enlace venció o ya se usó. Pide uno nuevo." };
        return;
    }
    ctx.response.body = {
        ok: true,
        nombre: usuario.NombreCompleto.split(" ")[0],
        email: ocultarCorreo(usuario.Email),
    };
};

export const restablecerPassword = async (ctx: RouterContext<string>) => {
    const body = await ctx.request.body.json().catch(() => null);
    const validacion = restablecerPasswordSchema.safeParse(body);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const { token, password } = validacion.data;

    if (superaLimite(`restablecer:${ctx.request.ip}`, 20)) {
        ctx.response.status = 429;
        ctx.response.body = { error: "Demasiados intentos. Espera unos minutos." };
        return;
    }

    const usuario = await usuarioDelToken(token);
    if (!usuario) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Este enlace venció o ya se usó. Pide uno nuevo." };
        return;
    }

    if (await compare(password, usuario.PasswordHash)) {
        ctx.response.status = 400;
        ctx.response.body = { error: "La nueva contraseña debe ser distinta a la anterior." };
        return;
    }

    // Solo se cambia si la contraseña sigue siendo la misma de cuando se pidió
    // el enlace: así dos pestañas con el mismo enlace no la cambian dos veces.
    const resultado = await conexion.execute(
        `UPDATE usuarios SET PasswordHash = ? WHERE UsuarioId = ? AND PasswordHash = ?`,
        [await hash(password), usuario.UsuarioId, usuario.PasswordHash],
    );
    if (!resultado.affectedRows) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Este enlace venció o ya se usó. Pide uno nuevo." };
        return;
    }

    EmailService.enviarPasswordCambiada({
        to: usuario.Email,
        nombre: usuario.NombreCompleto,
    }).catch((e) => console.error("Correo de contraseña cambiada:", e));

    ctx.response.body = { ok: true, mensaje: "Tu contraseña se cambió. Ya puedes iniciar sesión." };
};
