import { z } from "zod";

/**
 * Express middleware to validate req.body against a Zod schema
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errorIssues = result.error.issues || [];
    const message = errorIssues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      success: false,
      message: `Validation failed: ${message}`,
      errors: result.error.format(),
    });
  }
  req.body = result.data;
  next();
};

/**
 * Express middleware to validate req.query against a Zod schema
 */
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errorIssues = result.error.issues || [];
    const message = errorIssues
      .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      success: false,
      message: `Query validation failed: ${message}`,
      errors: result.error.format(),
    });
  }
  req.validatedQuery = result.data;
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      if (!(key in result.data)) {
        delete req.query[key];
      }
    }
    Object.assign(req.query, result.data);
  }
  next();
};

/**
 * Express middleware to validate req.params against a Zod schema
 */
export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const errorIssues = result.error.issues || [];
    const message = errorIssues
      .map((issue) => `${issue.path.join(".") || "params"}: ${issue.message}`)
      .join("; ");
    return res.status(400).json({
      success: false,
      message: `Parameter validation failed: ${message}`,
      errors: result.error.format(),
    });
  }
  req.params = result.data;
  next();
};
