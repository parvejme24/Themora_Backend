// Operational error with an HTTP status. Thrown from services/controllers and
// turned into a JSON response by the global error handler.
export class AppError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = "Authentication required") {
    return new AppError(401, message);
  }

  static forbidden(message = "You do not have permission to perform this action") {
    return new AppError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new AppError(404, message);
  }

  static conflict(message = "Resource already exists", details?: unknown) {
    return new AppError(409, message, details);
  }
}
