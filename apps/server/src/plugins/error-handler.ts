import type { ErrorEnvelope } from "@ottv2/contracts";
import type { FastifyInstance } from "fastify";

import { AppError } from "../shared/errors/app-error.js";

function publicEnvelope(error: unknown): { statusCode: number; body: ErrorEnvelope } {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        severity: error.severity,
        details: error.details
      }
    };
  }

  if (error instanceof Error && "validation" in error && error.validation) {
    return {
      statusCode: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu yêu cầu không hợp lệ.",
        retryable: false,
        severity: "INVALID",
        details: {}
      }
    };
  }

  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
    const statusCode = error.statusCode;
    return {
      statusCode,
      body: {
        code: statusCode === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
        message: statusCode === 415 ? "Content-Type của request không được hỗ trợ." : "Dữ liệu yêu cầu không hợp lệ.",
        retryable: false,
        severity: "INVALID",
        details: {}
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi. Vui lòng thử lại.",
      retryable: true,
      severity: "RECOVERABLE",
      details: {}
    }
  };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => {
    const body: ErrorEnvelope = {
      code: "NOT_FOUND",
      message: "Không tìm thấy tài nguyên yêu cầu.",
      retryable: false,
      severity: "INVALID",
      details: {}
    };
    return reply.status(404).send(body);
  });

  app.setErrorHandler((error, request, reply) => {
    const response = publicEnvelope(error);
    request.log.error({ err: error, publicCode: response.body.code }, "request failed");
    return reply.status(response.statusCode).send(response.body);
  });
}
