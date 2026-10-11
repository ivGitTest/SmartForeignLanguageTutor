import type { ErrorRequestHandler } from "express";
import multer from "multer";

export class PrototypeError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}

export const prototypeError: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent || res.destroyed) return;
  const known = error instanceof PrototypeError;
  const large = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
  const multipart = error instanceof multer.MulterError;
  const invalidJson = error instanceof SyntaxError && "body" in error;
  const bodyLarge = error && typeof error === "object" && "type" in error && error.type === "entity.too.large";
  const status = known ? error.status : large || bodyLarge ? 413 : multipart || invalidJson ? 400 : 503;
  const code = known ? error.code : large || bodyLarge ? "PAYLOAD_TOO_LARGE" : multipart || invalidJson ? "INVALID_REQUEST" : "SERVICE_UNAVAILABLE";
  req.log.warn({ code, status }, "Request failed");
  res.status(status).json({
    error: {
      code,
      message: known ? error.message : large || bodyLarge ? "Превышен размер файла или запроса." : multipart || invalidJson ? "Некорректный запрос." : "Сервис временно недоступен. Повторите явно после проверки.",
      requestId: String(req.id),
      retryable: known ? error.retryable : status >= 500,
    },
  });
};
