/**
 * Erreurs applicatives.
 *
 * Chaque erreur porte un code stable, destiné aux interfaces, et un message en français destiné à
 * l'utilisateur. Les interfaces se branchent sur le code, jamais sur le texte.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Authentification requise.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = "Vous n'avez pas la permission d'effectuer cette action.") =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Ressource introuvable.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);

export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
