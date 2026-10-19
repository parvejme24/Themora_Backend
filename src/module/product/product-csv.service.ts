import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { parseCsv, toCsv } from "../../utils/csv";
import { buildWhere, productService } from "./product.service";
import {
  createProductSchema,
  CreateProductInput,
  ProductQuery,
  UpdateProductInput,
  updateProductSchema,
} from "./product.validation";

export const MAX_IMPORT_ROWS = 500;

const LIST_SEPARATOR = "|";
const FEATURE_SEPARATOR = " :: ";

type ExportedProduct = Awaited<ReturnType<typeof findForExport>>[number];

// How each column is written on export and read on import. `read` turns a
// cell into a value for the product schemas; returning undefined leaves the
// field unchanged (update) or at its default (create).
interface Column {
  name: string;
  write: (product: ExportedProduct) => string;
  read?: (cell: string) => unknown;
}

const text = (cell: string) => cell.trim() || undefined;
const nullableText = (cell: string) => cell.trim() || null;
const number = (cell: string) => cell.trim() || undefined;
const nullableNumber = (cell: string) => cell.trim() || null;
const list = (cell: string) =>
  cell
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
const lines = (cell: string) =>
  cell
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const boolean = (cell: string) => {
  const value = cell.trim().toLowerCase();
  if (["true", "yes", "1"].includes(value)) return true;
  if (["false", "no", "0", ""].includes(value)) return false;
  return cell; // rejected by the schema with a clear message
};

const joinList = (values: string[]) => values.join(` ${LIST_SEPARATOR} `);
const numberOrEmpty = (value: number | null) => (value == null ? "" : String(value));

const urlColumn = (name: "imageUrl" | "previewLink" | "videoUrl" | "figmaUrl" | "apkUrl" | "testflightUrl" | "playStoreUrl" | "appStoreUrl"): Column => ({
  name,
  write: (product) => product[name] ?? "",
  read: nullableText,
});

const COLUMNS: Column[] = [
  { name: "id", write: (product) => product.id },
  { name: "slug", write: (product) => product.slug, read: text },
  { name: "title", write: (product) => product.title, read: text },
  { name: "status", write: (product) => product.status, read: (cell) => text(cell)?.toUpperCase() },
  { name: "productType", write: (product) => product.productType, read: (cell) => text(cell)?.toUpperCase() },
  // Slug, or the id for the few categories without one
  { name: "category", write: (product) => product.category.slug ?? product.category.id },
  { name: "price", write: (product) => String(product.price), read: number },
  { name: "extendedPrice", write: (product) => numberOrEmpty(product.extendedPrice), read: nullableNumber },
  { name: "salePrice", write: (product) => numberOrEmpty(product.salePrice), read: nullableNumber },
  { name: "saleEndsAt", write: (product) => product.saleEndsAt?.toISOString() ?? "", read: nullableText },
  { name: "isFree", write: (product) => String(product.isFree), read: boolean },
  { name: "isFeatured", write: (product) => String(product.isFeatured), read: boolean },
  { name: "shortDescription", write: (product) => product.shortDescription, read: text },
  {
    name: "description",
    write: (product) => product.description.join("\n\n"),
    read: (cell) =>
      cell
        .split(/\r?\n\s*\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
  },
  { name: "whatsIncluded", write: (product) => product.whatsIncluded.join("\n"), read: lines },
  {
    name: "keyFeatures",
    write: (product) =>
      (product.keyFeatures as { title?: string; description?: string }[])
        .map((feature) => [feature.title ?? "", feature.description ?? ""].filter(Boolean).join(FEATURE_SEPARATOR))
        .join("\n"),
    read: (cell) =>
      lines(cell).map((line) => {
        const [title, ...rest] = line.split(FEATURE_SEPARATOR.trim());
        return { title: title.trim(), description: rest.join(FEATURE_SEPARATOR.trim()).trim() };
      }),
  },
  { name: "techStack", write: (product) => joinList(product.techStack), read: list },
  { name: "platforms", write: (product) => joinList(product.platforms), read: list },
  { name: "tags", write: (product) => joinList(product.tags.map((tag) => tag.name)), read: list },
  urlColumn("imageUrl"),
  { name: "screenshots", write: (product) => joinList(product.screenshots), read: list },
  urlColumn("previewLink"),
  urlColumn("videoUrl"),
  urlColumn("figmaUrl"),
  urlColumn("apkUrl"),
  urlColumn("testflightUrl"),
  urlColumn("playStoreUrl"),
  urlColumn("appStoreUrl"),
  { name: "fileSize", write: (product) => product.fileSize ?? "", read: nullableText },
  { name: "version", write: (product) => String(product.version), read: number },
  { name: "pages", write: (product) => String(product.pages), read: number },
];

const COLUMN_NAMES = COLUMNS.map((column) => column.name);
// Schema field → CSV column, for error messages
const fieldToColumn = (field: string) => (field === "categoryId" ? "category" : field);

function findForExport(query: ProductQuery) {
  return prisma.template.findMany({
    where: buildWhere(query, { publicOnly: false }),
    orderBy: { createdAt: "asc" },
    include: { category: { select: { id: true, slug: true } }, tags: { select: { name: true } } },
  });
}

export interface ImportRowError {
  row: number;
  column?: string;
  message: string;
}

interface PlannedRow {
  row: number;
  action: "create" | "update";
  id?: string;
  title: string;
  input: Record<string, unknown>;
}

export class ProductCsvService {
  async exportCsv(query: ProductQuery) {
    const products = await findForExport(query);
    return toCsv([COLUMN_NAMES, ...products.map((product) => COLUMNS.map((column) => column.write(product)))]);
  }

  // Rows with an id (or the slug of an existing product) update that product;
  // other rows create one. Every row is checked first and nothing is written
  // unless the whole file is valid.
  async importCsv(csv: string, { dryRun = false } = {}) {
    let rows: string[][];
    try {
      rows = parseCsv(csv);
    } catch (error) {
      throw AppError.badRequest((error as Error).message);
    }

    const [rawHeader, ...dataRows] = rows;
    if (!rawHeader || dataRows.length === 0) throw AppError.badRequest("The CSV has no product rows");
    if (dataRows.length > MAX_IMPORT_ROWS) {
      throw AppError.badRequest(`Import at most ${MAX_IMPORT_ROWS} products at a time (this file has ${dataRows.length})`);
    }

    const header = rawHeader.map((name) => name.trim());
    const unknown = header.filter((name) => !COLUMN_NAMES.includes(name));
    if (unknown.length) {
      throw AppError.badRequest(`Unknown columns: ${unknown.join(", ")}. Export the products to get a file with the right columns`);
    }
    const repeated = header.filter((name, index) => header.indexOf(name) !== index);
    if (repeated.length) throw AppError.badRequest(`Repeated columns: ${[...new Set(repeated)].join(", ")}`);

    const records = dataRows.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
    const { categories, byId, bySlug } = await this.loadReferences(records);

    const errors: ImportRowError[] = [];
    const plans: PlannedRow[] = [];
    const seenTargets = new Map<string, number>();

    dataRows.forEach((cells, index) => {
      const row = index + 2; // 1-based, after the header
      const record = records[index];
      const rowErrors: ImportRowError[] = [];
      const fail = (message: string, column?: string) => rowErrors.push({ row, column, message });

      if (cells.length > header.length) fail(`Has ${cells.length} values but the header has ${header.length} columns`);

      const id = record.id?.trim();
      const slug = record.slug?.trim();
      const existing = id ? byId.get(id) : slug ? bySlug.get(slug) : undefined;
      if (id && !existing) fail("No product has this id", "id");

      const target = existing?.id ?? (slug ? `slug:${slug}` : undefined);
      if (target) {
        const firstRow = seenTargets.get(target);
        if (firstRow) fail(`Same product as row ${firstRow}`, id ? "id" : "slug");
        else seenTargets.set(target, row);
      }
      if (slug && existing && bySlug.has(slug) && bySlug.get(slug)!.id !== existing.id) {
        fail("Another product already uses this slug", "slug");
      }

      const input: Record<string, unknown> = {};
      for (const column of COLUMNS) {
        if (!column.read || !header.includes(column.name)) continue;
        const value = column.read(record[column.name]);
        if (value !== undefined) input[column.name] = value;
      }

      const categoryCell = record.category?.trim();
      if (categoryCell) {
        const categoryId = categories.get(categoryCell);
        if (categoryId) input.categoryId = categoryId;
        else fail(`No category with the slug or id "${categoryCell}"`, "category");
      } else if (!existing) {
        fail("Required for new products", "category");
      }

      const schema = existing ? updateProductSchema : createProductSchema;
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] === undefined ? undefined : fieldToColumn(String(issue.path[0]));
          // A missing category is already reported above
          if (field === "category" && !categoryCell) continue;
          fail(issue.message, field);
        }
      }

      if (rowErrors.length) errors.push(...rowErrors);
      else {
        plans.push({
          row,
          action: existing ? "update" : "create",
          id: existing?.id,
          title: (parsed.data as { title?: string }).title ?? existing!.title,
          input: parsed.data as Record<string, unknown>,
        });
      }
    });

    if (errors.length) {
      const badRows = new Set(errors.map((error) => error.row)).size;
      throw AppError.badRequest(`${badRows} of ${dataRows.length} rows have problems, so nothing was imported`, errors);
    }

    const summary = {
      dryRun,
      created: plans.filter((plan) => plan.action === "create").length,
      updated: plans.filter((plan) => plan.action === "update").length,
      rows: plans.map(({ row, action, id, title }) => ({ row, action, id: id ?? null, title })),
    };
    if (dryRun) return summary;

    for (const [index, plan] of plans.entries()) {
      try {
        const product =
          plan.action === "create"
            ? await productService.create(plan.input as CreateProductInput)
            : await productService.update(plan.id!, plan.input as UpdateProductInput);
        summary.rows[index].id = product.id;
      } catch (error) {
        throw new AppError(
          (error as AppError).statusCode ?? 500,
          `Row ${plan.row} failed: ${(error as Error).message}. The ${index} rows before it were saved; fix this row and import the remaining rows again`
        );
      }
    }
    return summary;
  }

  private async loadReferences(records: Record<string, string>[]) {
    const ids = records.map((record) => record.id?.trim()).filter((id): id is string => Boolean(id));
    const slugs = records.map((record) => record.slug?.trim()).filter((slug): slug is string => Boolean(slug));
    const validIds = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));

    const [categoryRows, products] = await Promise.all([
      prisma.templateCategory.findMany({ select: { id: true, slug: true } }),
      validIds.length || slugs.length
        ? prisma.template.findMany({
            where: { OR: [{ id: { in: validIds } }, { slug: { in: slugs } }] },
            select: { id: true, slug: true, title: true },
          })
        : [],
    ]);

    // Categories can be given by slug or id
    const categories = new Map<string, string>();
    for (const category of categoryRows) {
      if (category.slug) categories.set(category.slug, category.id);
      categories.set(category.id, category.id);
    }
    return {
      categories,
      byId: new Map(products.map((product) => [product.id, product])),
      bySlug: new Map(products.map((product) => [product.slug, product])),
    };
  }
}

export const productCsvService = new ProductCsvService();
