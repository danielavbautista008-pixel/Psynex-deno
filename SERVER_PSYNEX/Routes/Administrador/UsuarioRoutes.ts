import { Router } from "../../Dependencies/dependencias.ts";
import { UsuarioController } from "../../Controller/Administrador/UsuarioController.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";

const UsuarioRoutes = new Router();

// Públicas
UsuarioRoutes.post("/login", UsuarioController.login);
UsuarioRoutes.post("/registro", UsuarioController.registrar);

// Requieren sesión iniciada
UsuarioRoutes.get("/usuarios/yo", requireAuth, UsuarioController.perfilPropio);

// Solo Admin. Las rutas fijas ("/resumen") van antes que las que llevan ":id".
UsuarioRoutes.get(
    "/usuarios",
    requireAuth,
    requiereRol("Admin"),
    UsuarioController.listar,
);
UsuarioRoutes.get(
    "/usuarios/resumen",
    requireAuth,
    requiereRol("Admin"),
    UsuarioController.resumen,
);
UsuarioRoutes.patch(
    "/usuarios/:id/estado",
    requireAuth,
    requiereRol("Admin"),
    UsuarioController.cambiarEstado,
);
UsuarioRoutes.get(
    "/usuarios/:id/observaciones",
    requireAuth,
    requiereRol("Admin"),
    UsuarioController.listarObservaciones,
);
UsuarioRoutes.post(
    "/usuarios/:id/observaciones",
    requireAuth,
    requiereRol("Admin"),
    UsuarioController.agregarObservacion,
);

export default UsuarioRoutes;