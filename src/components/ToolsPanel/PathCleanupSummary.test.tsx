import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PathCleanupSummary } from "./PathCleanupSummary";

describe("PathCleanupSummary", () => {
  it("lists each repeated and vanished entry before anything is applied", () => {
    render(
      <PathCleanupSummary
        duplicates={["C:\\Users\\me\\go\\bin", "C:\\Users\\me\\go\\bin"]}
        missing={["C:\\Users\\me\\AppData\\Local\\Programs\\Ollama"]}
        pending
      />,
    );
    expect(screen.getAllByText("C:\\Users\\me\\go\\bin")).toHaveLength(2);
    expect(screen.getByText("C:\\Users\\me\\AppData\\Local\\Programs\\Ollama")).toBeInTheDocument();
    expect(screen.getByText(/Undo puts it back/)).toBeInTheDocument();
  });

  it("says so when there is nothing to clean", () => {
    render(<PathCleanupSummary duplicates={[]} missing={[]} pending={false} />);
    expect(screen.getByText(/no duplicate or missing entries/)).toBeInTheDocument();
  });

  it("disappears once the cleanup has been applied", () => {
    const { container } = render(<PathCleanupSummary duplicates={["C:\\x"]} missing={[]} pending={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
