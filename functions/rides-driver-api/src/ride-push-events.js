import { Functions } from "node-appwrite";

const env = (name, fallback = "") =>
  String(process.env[name] ?? fallback).trim();

const PUSH_FUNCTION_ID = env(
  "NOOKLY_PUSH_FUNCTION_ID",
  "6a31d988001bf962fb57",
);

const RIDES_PUSH_SECRET = env(
  "NOOKLY_RIDES_PUSH_SECRET",
);

const PUSH_ROUTE = "/rides/event";

const normalizeEventType = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const queueDriverRidePushEvent = async (
  client,
  eventType,
  payload,
  {
    log = () => undefined,
    error = () => undefined,
  } = {},
) => {
  const normalizedEventType =
    normalizeEventType(eventType);

  if (!PUSH_FUNCTION_ID) {
    log(
      "Driver ride push skipped: NOOKLY_PUSH_FUNCTION_ID is not configured.",
    );

    return {
      queued: false,
      reason: "push-function-not-configured",
    };
  }

  if (!RIDES_PUSH_SECRET) {
    log(
      "Driver ride push skipped: NOOKLY_RIDES_PUSH_SECRET is not configured.",
    );

    return {
      queued: false,
      reason: "push-secret-not-configured",
    };
  }

  if (!normalizedEventType) {
    log(
      "Driver ride push skipped: event type is missing.",
    );

    return {
      queued: false,
      reason: "event-type-missing",
    };
  }

  try {
    const functions = new Functions(client);

    const execution =
      await functions.createExecution({
        functionId:
          PUSH_FUNCTION_ID,
        body: JSON.stringify({
          eventType:
            normalizedEventType,
          ...payload,
        }),
        async: true,
        xpath: PUSH_ROUTE,
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          "x-nookly-rides-secret":
            RIDES_PUSH_SECRET,
        },
      });

    log(
      JSON.stringify({
        event:
          "driver-ride-push-queued",
        rideEvent:
          normalizedEventType,
        executionId:
          execution.$id,
        executionStatus:
          execution.status,
      }),
    );

    return {
      queued: true,
      executionId:
        execution.$id,
      status:
        execution.status,
    };
  } catch (caught) {
    error(
      `Driver ride push queue failed (${normalizedEventType}): ${
        caught instanceof Error
          ? caught.message
          : String(caught)
      }`,
    );

    // Ride creation/cancellation/acceptance must remain successful even when
    // the secondary push service is temporarily unavailable.
    return {
      queued: false,
      reason:
        caught instanceof Error
          ? caught.message
          : String(caught),
    };
  }
};
