#!/usr/bin/env node
// Brands the generated Allure Report 3 HTML (site/reports/index.html) and
// injects a prominent "Back to Whichcraft" button to return to the LP.
//
// Allure 3 sets <title> from allurerc.mjs's `name` (padded with spaces)
// and emits no OGP metadata or navigation back to the main site.
// This script:
// 1. Cleans up title spacing
// 2. Injects Open Graph and meta description tags into <head>
// 3. Injects a responsive, theme-aware "Back to Whichcraft" button

import fs from "node:fs";
import path from "node:path";

export function brandAllureReportHtml(htmlContent) {
  let modified = htmlContent;

  // 1. Fix title whitespace
  modified = modified.replace(
    /<title>\s*Whichcraft\s*—\s*Test Reports\s*<\/title>/,
    "<title>Whichcraft — Test Reports</title>",
  );

  // 2. Inject meta tags and styles before </head> if not already present
  if (!modified.includes('property="og:site_name"')) {
    const metaAndStyles = `    <meta property="og:site_name" content="Whichcraft" />
    <meta property="og:title" content="Whichcraft — Test Reports" />
    <meta name="description" content="CI test reports for Whichcraft, the developer tool manager for Windows (https://nu-therabbit.github.io/Whichcraft/)." />
    <style id="whichcraft-back-btn-styles">
      .whichcraft-back-btn {
        position: fixed;
        top: 10px;
        right: 96px;
        z-index: 99999;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.4;
        text-decoration: none;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: all 0.15s ease-in-out;
        cursor: pointer;
        background: #ffffff;
        color: #1e293b;
        border: 1px solid #cbd5e1;
      }
      .whichcraft-back-btn:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
        color: #0f172a;
        text-decoration: none;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      }
      .whichcraft-back-btn svg {
        flex-shrink: 0;
        transition: transform 0.15s ease-in-out;
      }
      .whichcraft-back-btn:hover svg {
        transform: translateX(-2px);
      }
      @media (prefers-color-scheme: dark) {
        .whichcraft-back-btn {
          background: #1e293b;
          color: #f1f5f9;
          border: 1px solid #334155;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
        .whichcraft-back-btn:hover {
          background: #334155;
          border-color: #475569;
          color: #ffffff;
        }
      }
      html[data-theme='dark'] .whichcraft-back-btn,
      .theme-dark .whichcraft-back-btn,
      .dark .whichcraft-back-btn {
        background: #1e293b;
        color: #f1f5f9;
        border: 1px solid #334155;
      }
      html[data-theme='dark'] .whichcraft-back-btn:hover,
      .theme-dark .whichcraft-back-btn:hover,
      .dark .whichcraft-back-btn:hover {
        background: #334155;
        border-color: #475569;
        color: #ffffff;
      }
      html[data-theme='light'] .whichcraft-back-btn,
      .theme-light .whichcraft-back-btn,
      .light .whichcraft-back-btn {
        background: #ffffff;
        color: #1e293b;
        border: 1px solid #cbd5e1;
      }
      @media (max-width: 640px) {
        .whichcraft-back-btn {
          top: auto;
          bottom: 16px;
          right: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }
      }
    </style>
</head>`;
    modified = modified.replace("</head>", metaAndStyles);
  }

  // 3. Inject back button before </body> if not already present
  if (!modified.includes('id="whichcraft-back-btn"')) {
    const buttonHtml = `    <!-- Whichcraft Back to LP Button -->
    <a href="/Whichcraft/" class="whichcraft-back-btn" id="whichcraft-back-btn" title="Back to Whichcraft LP">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      <span>Back to Whichcraft</span>
    </a>
    <script>
      (function() {
        try {
          var btn = document.getElementById('whichcraft-back-btn');
          if (btn && document.referrer) {
            var ref = new URL(document.referrer);
            if (ref.origin === window.location.origin && ref.pathname.startsWith('/Whichcraft/')) {
              if (!ref.pathname.includes('/storybook') && !ref.pathname.includes('/reports')) {
                btn.href = ref.pathname;
              }
            }
          }
        } catch (e) {}
      })();
    </script>
</body>`;
    modified = modified.replace("</body>", buttonHtml);
  }

  return modified;
}

// CLI execution
const currentFile = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  const targetFile = process.argv[2] || "site/reports/index.html";
  if (!fs.existsSync(targetFile)) {
    console.error(`Error: target file not found: ${targetFile}`);
    process.exit(1);
  }
  const content = fs.readFileSync(targetFile, "utf8");
  const branded = brandAllureReportHtml(content);
  fs.writeFileSync(targetFile, branded, "utf8");
  console.log(`Branded Allure report and injected Back to LP button: ${targetFile}`);
}
