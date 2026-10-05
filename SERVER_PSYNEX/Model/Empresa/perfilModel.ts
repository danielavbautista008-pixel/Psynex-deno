import { conexion } from "../Model/conexion.ts";

export interface PerfilEmpresaData {
    perfileId?: string | null;
    usuarioId: string;
    nombreEmpresa: string;
    nit: string;
    sector?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    sitioWeb?: string | null;
    logo?: string | null;
    descripcion?: string | null;
    estaVerificada?: boolean;
    creadoEn?: Date | string | null;
}

export class PerfilEmpresa {
    public _ObjPerfilEmpresa: PerfilEmpresaData | null;
    public _perfileId: string | null;

    constructor(ObjPerfilEmpresa: PerfilEmpresaData | null = null, perfileId: string | null = null) {
        this._ObjPerfilEmpresa = ObjPerfilEmpresa;
        this._perfileId = perfileId;
    }

    public async SeleccionarPerfilesEmpresa(): Promise<PerfilEmpresaData[]> {
        const { rows: perfiles } = await conexion.execute(`SELECT * FROM perfil_empresa`);
        return perfiles as PerfilEmpresaData[];
    }
}