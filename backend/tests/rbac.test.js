import { requireRole } from "../src/middleware/auth.js";

describe("Role-Based Access Control (RBAC) Middleware", () => {
  function createMockContext(user) {
    const req = { user };
    const res = {
      statusCode: 200,
      jsonPayload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.jsonPayload = payload;
        return this;
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    return { req, res, next: () => next(), isNextCalled: () => nextCalled };
  }

  test("allows ADMIN user to access ADMIN-only endpoint", () => {
    const adminUser = { id: "u1", name: "Alice Admin", role: "ADMIN" };
    const { req, res, next, isNextCalled } = createMockContext(adminUser);

    const middleware = requireRole("ADMIN");
    middleware(req, res, next);

    expect(isNextCalled()).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  test("denies STAFF user access to ADMIN-only endpoint with 403 Forbidden", () => {
    const staffUser = { id: "u2", name: "Bob Staff", role: "STAFF" };
    const { req, res, next, isNextCalled } = createMockContext(staffUser);

    const middleware = requireRole("ADMIN");
    middleware(req, res, next);

    expect(isNextCalled()).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.jsonPayload).toEqual({ message: "Insufficient permissions" });
  });

  test("allows both ADMIN and STAFF on dual-permission endpoints", () => {
    const staffUser = { id: "u2", name: "Bob Staff", role: "STAFF" };
    const { req, res, next, isNextCalled } = createMockContext(staffUser);

    const middleware = requireRole("ADMIN", "STAFF");
    middleware(req, res, next);

    expect(isNextCalled()).toBe(true);
  });

  test("denies unauthenticated requests (null user) with 403", () => {
    const { req, res, next, isNextCalled } = createMockContext(null);

    const middleware = requireRole("ADMIN");
    middleware(req, res, next);

    expect(isNextCalled()).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
