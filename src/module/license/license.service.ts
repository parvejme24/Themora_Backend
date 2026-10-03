import { prisma } from "../../config/database";
import { ValidateLicenseInput, RevokeLicenseInput, License, PaginatedLicenses, LicenseStats, LicenseQuery, LicenseValidationResult } from "./license.type";

export class LicenseService {
  async getAllLicenses(query: LicenseQuery): Promise<PaginatedLicenses> {
    const { page, limit, userId, templateId, licenseType, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
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

    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
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
      prisma.license.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      licenses: licenses as License[],
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

  async getLicenseById(id: string): Promise<License | null> {
    const license = await prisma.license.findUnique({
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

    return license as License | null;
  }

  async validateLicense(data: ValidateLicenseInput): Promise<LicenseValidationResult> {
    const { licenseKey } = data;

    const license = await prisma.license.findUnique({
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
        license: license as License,
        message: "License has been revoked",
        isRevoked: true,
      };
    }

    const isExpired = license.expiresAt ? new Date() > license.expiresAt : false;
    if (isExpired) {
      return {
        isValid: false,
        license: license as License,
        message: "License has expired",
        isExpired: true,
      };
    }

    const remainingUsage = license.maxUsage ? license.maxUsage - license.usedCount : null;
    if (license.maxUsage && license.usedCount >= license.maxUsage) {
      return {
        isValid: false,
        license: license as License,
        message: "License usage limit exceeded",
        remainingUsage: 0,
      };
    }

    return {
      isValid: true,
      license: license as License,
      message: "License is valid",
      remainingUsage: remainingUsage ?? undefined,
    };
  }

  async revokeLicense(id: string, data: RevokeLicenseInput): Promise<{ success: boolean; message: string }> {
    const license = await prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      return { success: false, message: "License not found" };
    }

    if (!license.isActive) {
      return { success: false, message: "License is already revoked" };
    }

    await prisma.license.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true, message: "License revoked successfully" };
  }

  async getLicenseStats(): Promise<LicenseStats> {
    const [
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      licensesByType,
      licensesByTemplate,
    ] = await Promise.all([
      prisma.license.count(),
      prisma.license.count({ where: { isActive: true } }),
      prisma.license.count({
        where: {
          expiresAt: { lt: new Date() },
        },
      }),
      prisma.license.groupBy({
        by: ['licenseType'],
        _count: { id: true },
        where: { isActive: true },
      }),
      prisma.license.groupBy({
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

    // Get template names for the template IDs
    const templateIds = licensesByTemplate.map(item => item.templateId);
    const templates = await prisma.template.findMany({
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

  async getUserLicenses(userId: string, query: Omit<LicenseQuery, 'userId'>): Promise<PaginatedLicenses> {
    return this.getAllLicenses({ ...query, userId });
  }
}
