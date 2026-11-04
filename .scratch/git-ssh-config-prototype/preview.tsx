import React from "react";
import ReactDOM from "react-dom/client";
import { i18nReady } from "../../src/i18n";
import { WhichcraftGitSshPrototype } from "../../src/features/git-config/prototype/WhichcraftGitSshPrototype";
import "../../src/index.css";

await i18nReady;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WhichcraftGitSshPrototype />
  </React.StrictMode>,
);
