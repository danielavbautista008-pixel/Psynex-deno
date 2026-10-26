import { Router } from "https://deno.land/x/oak/mod.ts";
import {
    getPerfiles,
    getPerfil,
    crearPerfil,
    actualizarPerfil,
    subirFoto,
} from "../../Controller/Paciente/perfilController.ts";

const PerfilPacienteRouter = new Router();

PerfilPacienteRouter.get("/perfilpaciente", getPerfiles);
PerfilPacienteRouter.get("/perfilpaciente/:id", getPerfil);
PerfilPacienteRouter.post("/perfilpaciente", crearPerfil);
PerfilPacienteRouter.put("/perfilpaciente/:id", actualizarPerfil);
PerfilPacienteRouter.post("/perfilpaciente/:id/foto", subirFoto);

export { PerfilPacienteRouter };