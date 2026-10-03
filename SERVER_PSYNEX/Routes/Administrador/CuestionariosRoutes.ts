import { Router } from "../../Dependencies/dependencias.ts";
import { CuestionarioController } from "../../Controller/Administrador/CuestionariosController.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";

export const CuestionariosRouter = new Router();

// ORDEN IMPORTANTE: las rutas fijas ("/categorias", "/estadisticas") van ANTES de "/:id".
// Si no, Oak leería la palabra "categorias" como si fuera un id.

// RF-24: cualquier usuario con sesión iniciada
CuestionariosRouter.get(
    "/cuestionarios",
    requireAuth,
    CuestionarioController.listar,
);

// Categorías para el selector del Administrador y para los filtros
CuestionariosRouter.get(
    "/cuestionarios/categorias",
    requireAuth,
    CuestionarioController.listarCategorias,
);

// RF-42: estadísticas de uso, solo Administrador
CuestionariosRouter.get(
    "/cuestionarios/estadisticas",
    requireAuth,
    requiereRol("Admin"),
    CuestionarioController.estadisticas,
);

// Detalle con preguntas y opciones, para responderlo (cualquier usuario con sesión)
CuestionariosRouter.get(
    "/cuestionarios/:id",
    requireAuth,
    CuestionarioController.obtenerConPreguntas,
);

// RF-42: crear un cuestionario, solo Administrador
CuestionariosRouter.post(
    "/cuestionarios",
    requireAuth,
    requiereRol("Admin"),
    CuestionarioController.crear,
);

// RF-42: activar o desactivar, solo Administrador
CuestionariosRouter.patch(
    "/cuestionarios/:id/estado",
    requireAuth,
    requiereRol("Admin"),
    CuestionarioController.cambiarEstado,
);

// También como default, así sirve con cualquiera de los dos estilos de import
export default CuestionariosRouter;