# Git and SSH configuration

Open **Git config** or **SSH** under Configuration in the sidebar. These workspaces manage configuration files independently of Tool Installation Selections and Tool Profiles. Git/SSH labels currently use English fallback in other interface languages.

## Inspect a repository

Choose a repository to see the commit name and email supplied by native Git, each field's source, and the ordered configuration sources. With Global configuration selected, inspect system/global configuration without choosing a repository. The executable picker uses Git installations Whichcraft has already found; it does not change the selected Tool Installation.

Identity shows commit identity and authentication-related references. includeIf lists conditional rules; Behavior and All configuration expose other settings. Commit identity does not establish a hosting-service login. If Git refuses a repository because of ownership, the app explains the refusal and supplies a safe.directory command for you to review and run yourself; it does not change trust settings.

## Supported changes

| Workspace | Editable through forms |
| --- | --- |
| Git config | Existing user.name, user.email, and core.sshCommand occurrences in supported writable sources |
| includeIf | Add or edit global gitdir, gitdir/i, and hasconfig:remote.*.url rules pointing to existing files |
| SSH | One existing IdentityFile occurrence in its declaring writable source |

Click Edit, change the form, and select Preview to review the exact target and diff. Conditional-rule impact compares the selected and remembered repositories; it does not scan every repository on the machine. A matched rule may leave the effective email unchanged because a local value overrides it. A result marked unresolved is not a verified prediction.

Preview and Cancel do not write configuration. Apply validates the plan again, publishes the file change, then reads it back. Refresh and preview again if the context or a dependency changed. Switching between Git config and SSH shows an editor only in the workspace that owns its draft.

## SSH evidence

SSH shows hosts, configuration sources, ordered identity references, and public-key metadata. It starts from the client Git would use and lets you choose another detected client. Windows OpenSSH and Git's bundled SSH can read different files. Relative Include paths use the client's configuration context; relative IdentityFile paths use Git's working directory.

Inspection does not connect to a server, execute configured commands, alter known_hosts, or manage agent identities. It does not show private-key contents. Dynamic Match conditions remain unresolved, and key references do not prove authentication success.

## Undo and limits

Undo reverses the latest successful configuration operation across Git and SSH, including after restart. It preserves unrelated later edits and refuses a conflicting or ambiguous target. Interrupted or unverified operations appear in the recovery banner. There is one configuration Undo level, separate from Environment and Tools.

System and worktree-specific sources are inspection-only. Unsupported syntax, encodings, protected/redirected sources, and secret-bearing entries can also be read-only. The forms do not create identity files, generate keys, delete/reorder rules, or provide arbitrary file editing. Writes require a filesystem that supports the Windows transactional publication guard.

Remote-URL rules require Git 2.36 or newer. Impact preview requires Git 2.32 or newer; local-source edits and shared global/local include chains can be unresolved. Repository trust failures are not bypassed. Configuration changes do not switch tool versions or create per-project Tool Profiles.

The [feature spec](../.scratch/git-ssh-config/spec.md), [implementation evidence](../.scratch/git-ssh-config/implementation.md), and [ADR-0007](adr/0007-native-git-authority-and-separate-config-journal.md) record the full acceptance contract and capability limits.
