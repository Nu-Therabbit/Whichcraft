import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ToolApplyPlan } from "../../types";
import { PlanDiffList } from "./PlanDiffList";

const plan = {
  requiresUac: false,
  warnings: [],
  limitationNotice: "",
  userDiffs: [
    {
      name: "JAVA_HOME",
      scope: "User",
      before: "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.8",
      after: "C:\\Developer\\Java\\jdk-17.0.16",
      valueKind: "String",
    },
  ],
  systemDiffs: [],
} as unknown as ToolApplyPlan;

describe("PlanDiffList", () => {
  it("wraps values instead of cutting them, so the whole change can be reviewed", () => {
    render(<PlanDiffList plan={plan} />);

    for (const value of ["C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.8", "C:\\Developer\\Java\\jdk-17.0.16"]) {
      const el = screen.getByText(value);
      expect(el).toHaveClass("wrap-anywhere");
      expect(el).not.toHaveClass("truncate");
    }
  });
});
