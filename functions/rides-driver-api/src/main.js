/**
 * NOOKLY_DRIVER_APPLICATIONS_FAST_ROUTE
 * Preserves the existing rides-driver-api and intercepts only the
 * expensive organization driver-list request.
 */
import baseHandler from "./main-before-driver-fast-route.js";
import organizationDriverReviewFast from "./organization-driver-review-fast.js";
import organizationDriverReview from "./organization-driver-review.js";

const normalizePath = (value) =>
  String(value ?? "/").replace(/\/+$/, "") || "/";

export default async (context) => {
  const method = String(context?.req?.method ?? "GET").toUpperCase();
  const requestPath = normalizePath(context?.req?.path);

  if (
    method === "GET" &&
    requestPath === "/organization/drivers-fast"
  ) {
    return organizationDriverReviewFast(context);
  }

  // NOOKLY_ORGANIZATION_DRIVER_REVIEW_ROUTES
  if (
    requestPath.startsWith("/organization/drivers/") &&
    (method === "GET" || method === "POST")
  ) {
    return organizationDriverReview(context);
  }

  return baseHandler(context);
};
