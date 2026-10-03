"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseService = void 0;
const database_1 = require("../../config/database");
class LicenseService {
    async getAllLicenses(query) {
        const { page, limit, userId, templateId, licenseType, isActive, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (userId) {
            where.userId = userId;
        }
        if (templateId) {
            where.templateId = templateId;
        }
        if (licenseType) {
            where.licenseType = licenseType;
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }
        const orderBy = {};
        orderBy[sortBy] = sortOrder;
        const [licenses, total] = await Promise.all([
            database_1.prisma.license.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    order: {
                        select: {
                            id: true,
                            status: true,
                            totalAmount: true,
                            customerEmail: true,
                        },
                    },
                    template: {
                        select: {
                            id: true,
                            title: true,
                            price: true,
                            imageUrl: true,
                            shortDescription: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                        },
                    },
                },
            }),
            database_1.prisma.license.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            licenses: licenses,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async getLicenseById(id) {
        const license = await database_1.prisma.license.findUnique({
            where: { id },
            include: {
                order: {
                    select: {
                        id: true,
                        status: true,
                        totalAmount: true,
                        customerEmail: true,
                    },
                },
                template: {
                    select: {
                        id: true,
                        title: true,
                        price: true,
                        imageUrl: true,
                        shortDescription: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });
        return license;
    }
    async validateLicense(data) {
        const { licenseKey } = data;
        const license = await database_1.prisma.license.findUnique({
            where: { licenseKey },
            include: {
                order: {
                    select: {
                        id: true,
                        status: true,
                        totalAmount: true,
                        customerEmail: true,
                    },
                },
                template: {
                    select: {
                        id: true,
                        title: true,
                        price: true,
                        imageUrl: true,
                        shortDescription: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });
        if (!license) {
            return {
                isValid: false,
                message: "License key not found",
            };
        }
        if (!license.isActive) {
            return {
                isValid: false,
                license: license,
                message: "License has been revoked",
                isRevoked: true,
            };
        }
        const isExpired = license.expiresAt ? new Date() > license.expiresAt : false;
        if (isExpired) {
            return {
                isValid: false,
                license: license,
                message: "License has expired",
                isExpired: true,
            };
        }
        const remainingUsage = license.maxUsage ? license.maxUsage - license.usedCount : null;
        if (license.maxUsage && license.usedCount >= license.maxUsage) {
            return {
                isValid: false,
                license: license,
                message: "License usage limit exceeded",
                remainingUsage: 0,
            };
        }
        return {
            isValid: true,
            license: license,
            message: "License is valid",
            remainingUsage: remainingUsage ?? undefined,
        };
    }
    async revokeLicense(id, data) {
        const license = await database_1.prisma.license.findUnique({
            where: { id },
        });
        if (!license) {
            return { success: false, message: "License not found" };
        }
        if (!license.isActive) {
            return { success: false, message: "License is already revoked" };
        }
        await database_1.prisma.license.update({
            where: { id },
            data: { isActive: false },
        });
        return { success: true, message: "License revoked successfully" };
    }
    async getLicenseStats() {
        const [totalLicenses, activeLicenses, expiredLicenses, licensesByType, licensesByTemplate,] = await Promise.all([
            database_1.prisma.license.count(),
            database_1.prisma.license.count({ where: { isActive: true } }),
            database_1.prisma.license.count({
                where: {
                    expiresAt: { lt: new Date() },
                },
            }),
            database_1.prisma.license.groupBy({
                by: ['licenseType'],
                _count: { id: true },
                where: { isActive: true },
            }),
            database_1.prisma.license.groupBy({
                by: ['templateId'],
                _count: { id: true },
                where: { isActive: true },
            }),
        ]);
        const licensesByTypeFormatted = licensesByType.map((item) => ({
            licenseType: item.licenseType,
            count: item._count.id,
            activeCount: item._count.id,
        }));
        const templateIds = licensesByTemplate.map(item => item.templateId);
        const templates = await database_1.prisma.template.findMany({
            where: { id: { in: templateIds } },
            select: { id: true, title: true },
        });
        const templateMap = new Map(templates.map(t => [t.id, t.title]));
        const licensesByTemplateFormatted = licensesByTemplate.map((item) => ({
            templateId: item.templateId,
            templateName: templateMap.get(item.templateId) || "Unknown",
            licenseCount: item._count.id,
            activeCount: item._count.id,
        }));
        return {
            totalLicenses,
            activeLicenses,
            expiredLicenses,
            licensesByType: licensesByTypeFormatted,
            licensesByTemplate: licensesByTemplateFormatted,
        };
    }
    async getUserLicenses(userId, query) {
        return this.getAllLicenses({ ...query, userId });
    }
}
exports.LicenseService = LicenseService;
//# sourceMappingURL=license.service.js.map