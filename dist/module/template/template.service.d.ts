import { ITemplateService } from "./template.interface";
import { CreateTemplateInput, UpdateTemplateInput, Template, PaginatedTemplates, TemplateStats, TemplateQuery } from "./template.type";
export declare class TemplateService implements ITemplateService {
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
//# sourceMappingURL=template.service.d.ts.map