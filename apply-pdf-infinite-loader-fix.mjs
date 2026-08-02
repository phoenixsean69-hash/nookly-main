import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const viewerPath = path.join(
  root,
  "app",
  "(root)",
  "lease-viewer.tsx",
);

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

if (!fs.existsSync(viewerPath)) {
  fail(`Lease viewer was not found at ${viewerPath}`);
}

const backupPath =
  `${viewerPath}.pdf-infinite-loader-fix.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(viewerPath, backupPath);
}

let source = fs.readFileSync(viewerPath, "utf8");

const replaceRequired = (
  current,
  search,
  replacement,
  label,
) => {
  if (!current.includes(search)) {
    fail(
      `Could not find ${label}. The viewer differs from the expected version.`,
    );
  }

  return current.replace(search, replacement);
};

// Add useEffect for a defensive loading-overlay timeout.
source = replaceRequired(
  source,
  `import React, { useMemo, useState } from "react";`,
  `import React, { useEffect, useMemo, useState } from "react";`,
  "the React import",
);

// Reset loading whenever a different local file is opened and remove the
// custom overlay after a reasonable fallback period. This does not cancel
// PDF rendering; it only prevents the overlay from hiding an already-rendered
// native PDF view when Android omits onLoadComplete.
source = replaceRequired(
  source,
  `  const source = useMemo(
    () => ({
      uri: localUri,
      cache: false,
    }),
    [localUri],
  );

  const handleDownload = async () => {`,
  `  const source = useMemo(
    () => ({
      uri: localUri,
      cache: false,
    }),
    [localUri],
  );

  useEffect(() => {
    setLoading(true);
    setErrorMessage("");
    setPage(1);
    setNumberOfPages(0);

    if (!localUri) return;

    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [localUri]);

  const handleDownload = async () => {`,
  "the viewer source block",
);

// Do not repeatedly turn the overlay back on after the PDF starts rendering.
source = replaceRequired(
  source,
  `          onLoadProgress={() => {
            setLoading(true);
          }}
          onLoadComplete={(pages) => {`,
  `          onLoadComplete={(pages) => {`,
  "the PDF load-progress handler",
);

// Android versions of react-native-pdf can omit onLoadComplete.
// onPageChanged is known to fire once the first page is actually rendered.
source = replaceRequired(
  source,
  `          onPageChanged={(currentPage, pages) => {
            setPage(currentPage);
            setNumberOfPages(pages);
          }}`,
  `          onPageChanged={(currentPage, pages) => {
            setPage(currentPage);
            setNumberOfPages(pages);
            setErrorMessage("");
            setLoading(false);
          }}`,
  "the PDF page-changed handler",
);

// Avoid react-native-pdf's separate built-in spinner because this screen
// already owns the loading presentation.
source = replaceRequired(
  source,
  `          spacing={10}
          onLoadComplete`,
  `          spacing={10}
          renderActivityIndicator={() => null}
          onLoadComplete`,
  "the PDF spacing/load block",
);

if (source.includes("onLoadProgress")) {
  fail("The old onLoadProgress state handler is still present.");
}

if (
  !source.includes(
    `onPageChanged={(currentPage, pages) => {
            setPage(currentPage);
            setNumberOfPages(pages);
            setErrorMessage("");
            setLoading(false);`,
  )
) {
  fail("The first-page loading fallback was not installed.");
}

fs.writeFileSync(viewerPath, source, "utf8");

console.log(`
Nookly PDF infinite-loader fix applied.

Updated:
- app/(root)/lease-viewer.tsx

Changes:
- Loading no longer gets re-enabled by repeated progress events.
- The overlay closes when the first PDF page renders.
- An 8-second defensive fallback prevents a permanent overlay.
- The PDF component's duplicate built-in spinner is disabled.

Next run:
npx tsc --noEmit
`);
