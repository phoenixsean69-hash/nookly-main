/**
 * NOOKLY_COMBINED_RIDES_FUNCTION
 *
 * One Appwrite Function serves:
 * - existing driver dashboard, assigned rides, tracking and incidents;
 * - student ride requests;
 * - driver marketplace requests and offers;
 * - student offer acceptance and confirmed ride creation.
 */

import driverHandler from "./driver-handler.js";
import marketplaceHandler from "./marketplace-handler.js";

const isMarketplacePath = (rawPath) => {
  const path = String(rawPath || "/").replace(/\/+$/, "") || "/";

  return (
    path === "/student" ||
    path.startsWith("/student/") ||
    path === "/driver/requests" ||
    path.startsWith("/driver/requests/") ||
    path === "/driver/offers" ||
    path.startsWith("/driver/offers/")
  );
};

export default async (context) => {
  const path = context?.req?.path || "/";

  if (isMarketplacePath(path)) {
    return marketplaceHandler(context);
  }

  return driverHandler(context);
};
