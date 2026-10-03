import { Template, PaginatedTemplates, TemplateStats, CreateTemplateInput, UpdateTemplateInput, TemplateQuery } from "./template.type";
export interface ITemplateService {
    getAllTemplates(query: TemplateQuery): Promise<PaginatedTemplates>;
    getTemplateById(id: string): Promise<Template | null>;
    createTemplate(data: CreateTemplateInput): Promise<Template>;
    updateTemplate(id: string, data: UpdateTemplateInput): Promise<Template | null>;
    deleteTemplate(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getNewArrivals(limit?: number): Promise<Template[]>;
    getTemplateStats(): Promise<TemplateStats>;
}
//# sourceMappingURL=template.interface.d.ts.map