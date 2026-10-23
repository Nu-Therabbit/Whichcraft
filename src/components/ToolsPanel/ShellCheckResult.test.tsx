import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellCheckResult } from "./ShellCheckResult";

describe("ShellCheckResult", () => {
  it("warns when the shell's profile runs another installation", () => {
    render(
      <ShellCheckResult
        check={{
          tool: "node",
          shell: "power_shell",
          effectivePath: "C:\\Program Files\\nodejs\\node.exe",
          shellPath: "C:\\tools\\node22\\node.exe",
          matches: false,
        }}
      />,
    );
    expect(screen.getByText(/PowerShell runs something else/)).toBeInTheDocument();
    expect(screen.getByText("C:\\Program Files\\nodejs\\node.exe")).toBeInTheDocument();
    expect(screen.getByText("C:\\tools\\node22\\node.exe")).toBeInTheDocument();
  });

  it("confirms when the shell agrees", () => {
    render(
      <ShellCheckResult
        check={{ tool: "node", shell: "cmd", effectivePath: "C:\\n\\node.exe", shellPath: "C:\\n\\node.exe", matches: true }}
      />,
    );
    expect(screen.getByText("Command Prompt runs the effective installation.")).toBeInTheDocument();
  });
});
