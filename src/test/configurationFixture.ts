import type { ConfigurationInspection, ConfigOccurrence } from "../features/configuration/api";
export function configurationFixture(repository = "E:/repos/sample"): ConfigurationInspection {
  const occurrence = (key: string, value: string, source: string): ConfigOccurrence => ({
    id: key,
    key,
    value,
    source,
    scope: "local",
    line: 3,
    editable: true,
    reason: null,
  });
  const name = occurrence("user.name", "Sample Developer", "~/.gitconfig");
  const email = occurrence("user.email", "local@example.test", `${repository}/.git/config`);
  return {
    id: "inspection-1",
    context: { repository, git: null, sshClient: null },
    executables: [{ path: "C:/Git/cmd/git.exe", label: "Git 2.56", effective: true }],
    recentRepositories: [{ path: repository, available: true }],
    git: {
      executable: "C:/Git/cmd/git.exe",
      version: "git version 2.56",
      remoteRules: true,
      impactPreview: true,
      repository,
      gitDirectory: `${repository}/.git`,
      commonDirectory: `${repository}/.git`,
      identity: { name, email },
      occurrences: [name, email],
      sources: [
        {
          path: email.source,
          scope: "local",
          includedFrom: null,
          revision: "a",
          content: "[user]\nemail = local@example.test\n",
          writable: true,
          reason: null,
        },
      ],
      rules: [],
      diagnostics: [],
      trustCommand: null,
    },
    ssh: {
      client: null,
      clients: [],
      command: null,
      sources: [],
      hosts: [],
      keys: [],
      diagnostics: [],
    },
    operation: null,
  };
}
