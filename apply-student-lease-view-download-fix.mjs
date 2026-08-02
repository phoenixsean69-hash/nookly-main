import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const filePath = path.join(
  root,
  "app",
  "(root)",
  "(student)",
  "s-myRequests.tsx",
);

if (!fs.existsSync(filePath)) {
  throw new Error(
    `Student requests screen not found: ${filePath}\n` +
      "Run this installer from the Nookly project root.",
  );
}

const original = fs.readFileSync(
  filePath,
  "utf8",
);

const APPLIED_MARKER =
  "Student lease notification deep-link support";

if (
  original.includes(APPLIED_MARKER) &&
  original.includes(
    "Lease ready",
  )
) {
  console.log("");
  console.log(
    "Student lease View/Download fix is already applied.",
  );
  process.exit(0);
}

function replaceOnce(
  content,
  search,
  replacement,
  label,
) {
  const first = content.indexOf(search);

  if (first < 0) {
    throw new Error(
      `Could not locate ${label}. No files were changed.`,
    );
  }

  const second = content.indexOf(
    search,
    first + search.length,
  );

  if (second >= 0) {
    throw new Error(
      `Found more than one ${label}. No files were changed.`,
    );
  }

  return (
    content.slice(0, first) +
    replacement +
    content.slice(first + search.length)
  );
}

let patched = original;

patched = replaceOnce(
  patched,
  'import { router } from "expo-router";',
  'import { router, useLocalSearchParams } from "expo-router";',
  "Expo Router import",
);

patched = replaceOnce(
  patched,
  'import React, { useEffect, useState } from "react";',
  'import React, { useEffect, useRef, useState } from "react";',
  "React hooks import",
);

const tenantMarker =
  '  const isTenant = user?.userMode === "tenant" || user?.userMode === "student";\n';

const deepLinkBlock = `${tenantMarker}
  // Student lease notification deep-link support
  const { requestId: requestIdParam } =
    useLocalSearchParams<{
      requestId?: string | string[];
    }>();

  const notificationRequestId =
    Array.isArray(requestIdParam)
      ? requestIdParam[0]
      : requestIdParam;

  const openedLeaseRequestIdRef =
    useRef<string | null>(null);
`;

patched = replaceOnce(
  patched,
  tenantMarker,
  deepLinkBlock,
  "student-mode marker",
);

const oldFetchEffect = `  useEffect(() => {
    if (isTenant) {
      fetchRequests();
    }
  }, [isTenant]);
`;

const newFetchEffect = `  useEffect(() => {
    if (isTenant) {
      fetchRequests();
    }
  }, [isTenant, notificationRequestId]);

  useEffect(() => {
    if (
      loading ||
      !notificationRequestId ||
      openedLeaseRequestIdRef.current ===
        notificationRequestId
    ) {
      return;
    }

    const notificationRequest =
      requests.find(
        (request) =>
          request.$id ===
          notificationRequestId,
      );

    if (
      !notificationRequest ||
      !notificationRequest.leaseDocumentId
    ) {
      return;
    }

    openedLeaseRequestIdRef.current =
      notificationRequestId;

    setSelectedRequest(
      notificationRequest,
    );
    setDetailsModalVisible(true);
  }, [
    loading,
    notificationRequestId,
    requests,
  ]);
`;

patched = replaceOnce(
  patched,
  oldFetchEffect,
  newFetchEffect,
  "request-loading effect",
);

const listActionsAnchor = `                  {/* Action Buttons */}
                  <View className="flex-row gap-2 mt-3">
                    {/* Add Query Button - Only for accepted/approved requests */}
`;

const inlineLeaseCard = `                  {/* Lease controls shown directly on the request card */}
                  {item.leaseDocumentId && (
                    <View
                      className="mt-4 rounded-2xl p-4"
                      style={{
                        backgroundColor:
                          theme.primary[100],
                        borderWidth: 1,
                        borderColor:
                          theme.primary[300] +
                          "50",
                      }}
                    >
                      <View className="flex-row items-center">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center mr-3"
                          style={{
                            backgroundColor:
                              theme.surface,
                          }}
                        >
                          <Ionicons
                            name="document-text"
                            size={21}
                            color={
                              theme.primary[300]
                            }
                          />
                        </View>

                        <View className="flex-1">
                          <Text
                            className="text-sm font-rubik-bold"
                            style={{
                              color: theme.title,
                            }}
                          >
                            Lease ready
                          </Text>

                          <Text
                            numberOfLines={1}
                            className="text-xs mt-0.5"
                            style={{
                              color: theme.muted,
                            }}
                          >
                            {item.leaseDocumentName ||
                              "Lease agreement.pdf"}
                          </Text>

                          {item.leaseSentAt && (
                            <Text
                              className="text-[11px] mt-0.5"
                              style={{
                                color:
                                  theme.muted,
                              }}
                            >
                              Sent{" "}
                              {new Date(
                                item.leaseSentAt,
                              ).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View className="flex-row gap-2 mt-3">
                        <TouchableOpacity
                          disabled={
                            leaseActionRequestId ===
                            item.$id
                          }
                          onPress={(event) => {
                            event.stopPropagation();
                            void handlePreviewLease(
                              item.$id,
                            );
                          }}
                          className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
                          style={{
                            backgroundColor:
                              theme.surface,
                            borderWidth: 1,
                            borderColor:
                              theme.primary[300],
                            opacity:
                              leaseActionRequestId ===
                              item.$id
                                ? 0.65
                                : 1,
                          }}
                        >
                          {leaseActionRequestId ===
                          item.$id ? (
                            <ActivityIndicator
                              size="small"
                              color={
                                theme.primary[300]
                              }
                            />
                          ) : (
                            <>
                              <Ionicons
                                name="eye"
                                size={19}
                                color={
                                  theme.primary[300]
                                }
                              />
                              <Text
                                className="ml-2 text-sm font-rubik-bold"
                                style={{
                                  color:
                                    theme.primary[300],
                                }}
                              >
                                View
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          disabled={
                            leaseActionRequestId ===
                            item.$id
                          }
                          onPress={(event) => {
                            event.stopPropagation();
                            void handleDownloadLease(
                              item.$id,
                              item.leaseDocumentName ||
                                "lease_document.pdf",
                            );
                          }}
                          className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
                          style={{
                            backgroundColor:
                              theme.primary[300],
                            opacity:
                              leaseActionRequestId ===
                              item.$id
                                ? 0.65
                                : 1,
                          }}
                        >
                          {leaseActionRequestId ===
                          item.$id ? (
                            <ActivityIndicator
                              size="small"
                              color="#FFFFFF"
                            />
                          ) : (
                            <>
                              <Ionicons
                                name="download"
                                size={19}
                                color="#FFFFFF"
                              />
                              <Text className="ml-2 text-sm font-rubik-bold text-white">
                                Download
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

${listActionsAnchor}`;

patched = replaceOnce(
  patched,
  listActionsAnchor,
  inlineLeaseCard,
  "student request-card action section",
);

const requiredMarkers = [
  'useLocalSearchParams',
  'useRef',
  APPLIED_MARKER,
  'openedLeaseRequestIdRef',
  'notificationRequest.leaseDocumentId',
  'Lease ready',
  'void handlePreviewLease(',
  'void handleDownloadLease(',
];

for (const marker of requiredMarkers) {
  if (!patched.includes(marker)) {
    throw new Error(
      `Validation failed: ${marker} is missing. No files were changed.`,
    );
  }
}

const occurrenceChecks = [
  [
    'import { router, useLocalSearchParams } from "expo-router";',
    1,
  ],
  [
    'Student lease notification deep-link support',
    1,
  ],
  [
    'Lease controls shown directly on the request card',
    1,
  ],
];

for (const [marker, expected] of occurrenceChecks) {
  const count = patched.split(marker).length - 1;

  if (count !== expected) {
    throw new Error(
      `Validation failed: expected ${expected} occurrence(s) of ${marker}, found ${count}. No files were changed.`,
    );
  }
}

const backupPath =
  `${filePath}.student-lease-view-download.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(
    filePath,
    backupPath,
  );
}

fs.writeFileSync(
  filePath,
  patched,
  "utf8",
);

console.log("");
console.log(
  "Student lease View/Download fix applied.",
);
console.log("");
console.log(
  "Updated: app/(root)/(student)/s-myRequests.tsx",
);
console.log("");
console.log(
  "The lease notification now opens the exact request.",
);
console.log(
  "View and Download also appear directly on the request card.",
);
console.log("");
console.log("Now run:");
console.log("npx tsc --noEmit");
