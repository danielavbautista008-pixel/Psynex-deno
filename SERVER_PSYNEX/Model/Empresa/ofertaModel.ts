import { conexion } from "../Model/conexion.ts";

export interface OfertaLaboralData {
    ofertaId?: string | null;
    perfileId: string;
    titulo: string;
    descripcion?: string | null;
    requisitos?: string | null;
    salario?: number | null;
    modalidad?: string | null;
    estado?: string;
    fechaPublicacion?: Date | string | null;
}

export class OfertaLaboral {
    public _ObjOfertaLaboral: OfertaLaboralData | null;
    public _ofertaId: string | null;

    constructor(ObjOfertaLaboral: OfertaLaboralData | null = null, ofertaId: string | null = null) {
        this._ObjOfertaLaboral = ObjOfertaLaboral;
        this._ofertaId = ofertaId;
    }

    // Método que ya tenías
    public async SeleccionarOfertasLaborales(): Promise<OfertaLaboralData[]> {
        const { rows: ofertas } = await conexion.execute(`SELECT * FROM "OfertasLaborales" WHERE "Estado" = 'Activa'`);
        return ofertas as OfertaLaboralData[];
    }

    public async SeleccionarPorId(id: string): Promise<OfertaLaboralData | null> {
        const { rows: ofertas } = await conexion.execute(
            `SELECT * FROM "OfertasLaborales" WHERE "OfertaId" = $1`,
            [id]
        );
        return ofertas.length > 0 ? (ofertas[0] as OfertaLaboralData) : null;
    }

    public async SeleccionarPorEmpresa(perfileId: string): Promise<OfertaLaboralData[]> {
        const { rows: ofertas } = await conexion.execute(
            `SELECT * FROM "OfertasLaborales" WHERE "PerfileId" = $1 AND "Estado" = 'Activa'`,
            [perfileId]
        );
        return ofertas as OfertaLaboralData[];
    }

    public async ContarOfertasActivasPorEmpresa(perfileId: string): Promise<number> {
        const { rows } = await conexion.execute(
            `SELECT COUNT(*) as total FROM "OfertasLaborales" WHERE "PerfileId" = $1 AND "Estado" = 'Activa'`,
            [perfileId]
        );
        return Number(rows[0]?.total ?? 0);
    }

    public async SeleccionarPublicas(): Promise<OfertaLaboralData[]> {
        const { rows: ofertas } = await conexion.execute(
            `SELECT * FROM "OfertasLaborales" WHERE "Estado" = 'Activa' LIMIT 3`
        );
        return ofertas as OfertaLaboralData[];
    }

    public async InsertarOferta(datos: OfertaLaboralData): Promise<OfertaLaboralData> {
        const id = datos.ofertaId || crypto.randomUUID();
        const fecha = datos.fechaPublicacion || new Date().toISOString();
        const estado = datos.estado || "Activa";

        await conexion.execute(
            `INSERT INTO "OfertasLaborales" 
             ("OfertaId", "PerfileId", "Titulo", "Descripcion", "Requisitos", "Salario", "Modalidad", "Estado", "FechaPublicacion")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                id,
                datos.perfileId,
                datos.titulo,
                datos.descripcion ?? null,
                datos.requisitos ?? null,
                datos.salario ?? null,
                datos.modalidad ?? null,
                estado,
                fecha
            ]
        );

        return {
            ...datos,
            ofertaId: id,
            estado,
            fechaPublicacion: fecha
        };
    }

    public async ActualizarOferta(id: string, datos: Partial<OfertaLaboralData>): Promise<boolean> {
        const result = await conexion.execute(
            `UPDATE "OfertasLaborales" 
             SET "Titulo" = $1, 
                 "Descripcion" = $2, 
                 "Requisitos" = $3, 
                 "Salario" = $4, 
                 "Modalidad" = $5
             WHERE "OfertaId" = $6`,
            [
                datos.titulo,
                datos.descripcion ?? null,
                datos.requisitos ?? null,
                datos.salario ?? null,
                datos.modalidad ?? null,
                id
            ]
        );
        return (result.affectedRows ?? 0) > 0;
    }

    public async DesactivarOferta(id: string): Promise<boolean> {
        const result = await conexion.execute(
            `UPDATE "OfertasLaborales" SET "Estado" = 'Cerrada' WHERE "OfertaId" = $1`,
            [id]
        );
        return (result.affectedRows ?? 0) > 0;
    }
}