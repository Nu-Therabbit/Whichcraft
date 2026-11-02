import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PythonLauncherInfo, SdkInventory } from "./SupplementalInfo";

describe("SdkInventory", () => {
  it("lists Android and MSVC pieces without any action buttons", () => {
    render(
      <SdkInventory
        android={{
          sdkRoot: "C:\\Users\\me\\AppData\\Local\\Android\\Sdk",
          rootSource: "default",
          platforms: ["android-34", "android-36.1"],
          buildTools: ["35.0.0"],
          ndk: ["26.3.11579264", "27.0.12077973"],
          platformTools: "37.0.1",
          emulator: "37.2.12",
          cmake: ["3.22.1"],
        }}
        msvc={{
          instances: [
            { displayName: "Visual Studio Build Tools 2022", version: "17.14", path: "C:\\BT", msvcToolsets: ["14.44.35207"] },
          ],
          windowsSdks: ["10.0.26100.0"],
        }}
      />,
    );
    // Each row keeps to one line, so what a narrow window cuts has to stay readable.
    expect(screen.getByText("26.3.11579264, 27.0.12077973")).toHaveAttribute("title", "26.3.11579264, 27.0.12077973");
    expect(screen.getByText("Visual Studio Build Tools 2022 17.14")).toHaveAttribute("title", "Visual Studio Build Tools 2022 17.14");
    expect(screen.getByText("14.44.35207")).toBeInTheDocument();
    expect(screen.getByText("10.0.26100.0")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says when no Android SDK was found", () => {
    render(<SdkInventory android={null} msvc={null} />);
    expect(screen.getByText(/No Android SDK found/)).toBeInTheDocument();
  });
});

describe("PythonLauncherInfo", () => {
  it("shows what py runs and warns about the Store alias", () => {
    render(
      <PythonLauncherInfo
        info={{
          launcherInstalled: true,
          launcherLines: [{ tag: "3.14[-64]", path: "C:\\py\\python.exe", isDefault: true }],
          storeStub: "C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe",
          note: "py does not see Python that Whichcraft installs.",
        }}
      />,
    );
    expect(screen.getByText(/py -V:3.14\[-64\]/)).toHaveTextContent("C:\\py\\python.exe");
    expect(screen.getByText(/Microsoft Store alias/)).toBeInTheDocument();
  });
});
