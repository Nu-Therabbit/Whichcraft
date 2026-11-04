// @ts-nocheck -- throwaway fixture model, not a production config parser.

/* Pure state + source-span editing. No DOM, persistence, filesystem or commands. */
const ConfigPrototype = (() => {
  const definitions = {
    system: {
      name: "Git system",
      path: "C:/Program Files/Git/etc/gitconfig",
      scope: "system",
      kind: "git",
      text: "[core]\n\tautocrlf = true\n[credential]\n\thelper = manager\n",
    },
    global: {
      name: "Git global",
      path: "~/.gitconfig",
      scope: "global",
      kind: "git",
      text: '\uFEFF# Personal defaults — keep this comment\r\n[user]\r\n\tname = Mali\r\n\temail = personal@example.test  # personal default\r\n[includeIf "hasconfig:remote.*.url:git@bitbucket.org:*/**"]\r\n\tpath = ~/.gitconfig-work\r\n[credential]\r\n\thelper = cache\r\n[alias]\r\n\tco = checkout\r\n',
    },
    work: {
      name: "Git work include",
      path: "~/.gitconfig-work",
      scope: "global · include",
      kind: "git",
      text: "# Work identity — managed by me\r\n[user]\r\n\tname = Mali Work\r\n\temail = work@company.example.test  # work only\r\n",
    },
    personal: {
      name: "Git personal include",
      path: "~/.gitconfig-personal",
      scope: "global · include",
      kind: "git",
      text: "# Personal identity\r\n[user]\r\n\tname = Mali Personal\r\n\temail = personal@example.test\r\n",
    },
    repoWork: {
      name: "Work repo local",
      path: "E:/Projects/work-demo/.git/config",
      scope: "local",
      kind: "git",
      text: '[core]\r\n\trepositoryformatversion = 0\r\n[remote "origin"]\r\n\turl = git@bitbucket.org:example/work-demo.git\r\n',
    },
    repoPersonal: {
      name: "Personal repo local",
      path: "E:/Projects/personal-demo/.git/config",
      scope: "local",
      kind: "git",
      text: '# Repo-specific overrides\r\n[user]\r\n\temail = mali@users.noreply.github.com\r\n[core]\r\n\tsshCommand = ssh -i ~/.ssh/id_personal -o IdentitiesOnly=yes\r\n[remote "origin"]\r\n\turl = git@github.com:example/personal-demo.git\r\n',
    },
    ssh: {
      name: "SSH main config",
      path: "~/.ssh/config",
      scope: "user",
      kind: "ssh",
      text: "\uFEFF# Shared SSH configuration\r\nInclude config.d/work.conf\r\n\r\nHost github-personal\r\n\tHostName github.com\r\n\tUser git\r\n\tIdentityFile ~/.ssh/id_personal\r\n\r\nHost *\r\n\tServerAliveInterval 30\r\n",
    },
    sshWork: {
      name: "SSH work include",
      path: "~/.ssh/config.d/work.conf",
      scope: "user · include",
      kind: "ssh",
      text: "# Preserve both identity candidates and this comment\r\nHost bitbucket.org\r\n\tUser git\r\n\tIdentityFile ~/.ssh/id_work  # primary work key\r\n\tIdentityFile ~/.ssh/id_work_backup\r\n\tIdentitiesOnly yes\r\n\tSendEnv LANG LC_*\r\n",
    },
  };
  const repos = {
    work: {
      label: "Work demo · Bitbucket",
      local: "repoWork",
      remote: "git@bitbucket.org:example/work-demo.git",
    },
    personal: {
      label: "Personal demo · GitHub",
      local: "repoPersonal",
      remote: "git@github.com:example/personal-demo.git",
    },
  };
  const copy = (value) => structuredClone(value);
  function lines(text) {
    const result = [];
    let start = 0;
    for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
      if (!match[0]) continue;
      result.push({ body: match[1], eol: match[2], start, index: result.length });
      start += match[0].length;
    }
    return result;
  }
  function valueSpan(body, start, comments) {
    let quoted = false,
      escaped = false,
      end = body.length;
    for (let i = start; i < body.length; i++) {
      const char = body[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') quoted = !quoted;
      if (!quoted && comments.includes(char)) {
        end = i;
        break;
      }
    }
    while (end > start && /\s/.test(body[end - 1])) end--;
    return { start, end, raw: body.slice(start, end) };
  }
  function decode(raw) {
    return raw.startsWith('"') && raw.endsWith('"')
      ? raw.slice(1, -1).replace(/\\(["\\])/g, "$1")
      : raw;
  }
  function records(fileId, text) {
    const file = definitions[fileId],
      result = [];
    let section = "",
      condition = "",
      host = "*",
      block = "global",
      sectionStart = 0,
      sectionIndex = 0;
    for (const line of lines(text)) {
      const body = line.body.replace(/^\uFEFF/, "");
      const bom = line.body.length - body.length;
      if (!body.trim() || /^\s*[#;]/.test(body)) continue;
      if (file.kind === "git") {
        const heading = body.match(/^\s*\[([\w.-]+)(?:\s+"(.*)")?\]\s*(?:[#;].*)?$/);
        if (heading) {
          section = heading[1].toLowerCase();
          condition = heading[2] || "";
          sectionStart = line.start;
          sectionIndex = line.index;
          continue;
        }
        const match = body.match(/^(\s*([\w.-]+)\s*=\s*)/);
        if (!match) continue;
        const span = valueSpan(line.body, bom + match[1].length, "#;");
        result.push({
          ...line,
          ...span,
          fileId,
          key: `${section}.${match[2].toLowerCase()}`,
          condition,
          sectionStart,
          sectionIndex,
          value: decode(span.raw),
          valueStart: line.start + span.start,
          valueEnd: line.start + span.end,
        });
      } else {
        const match = body.match(/^(\s*([A-Za-z][A-Za-z0-9]*)\s*(?:=\s*|\s+))/);
        if (!match) continue;
        const span = valueSpan(line.body, bom + match[1].length, "#");
        const key = match[2].toLowerCase();
        if (key === "host") {
          host = decode(span.raw);
          block = "host";
        }
        if (key === "match") {
          host = decode(span.raw);
          block = "match";
        }
        result.push({
          ...line,
          ...span,
          fileId,
          key,
          host,
          block,
          value: decode(span.raw),
          valueStart: line.start + span.start,
          valueEnd: line.start + span.end,
        });
      }
    }
    return result;
  }
  function find(state, target) {
    return records(target.fileId, state.files[target.fileId]).filter((r) => r.key === target.key)[
      target.ordinal || 0
    ];
  }
  function encoded(value, previous) {
    return previous.startsWith('"') || /[\s#;"]/.test(value)
      ? `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      : value;
  }
  function replacement(text, record, newRaw) {
    return text.slice(0, record.valueStart) + newRaw + text.slice(record.valueEnd);
  }
  function gitChain(state) {
    const chain = [];
    function visit(id, included = false, ancestors = []) {
      if (ancestors.includes(id)) return;
      for (const row of records(id, state.files[id])) {
        if (row.key === "includeif.path") {
          const target = includeFile(row.value);
          if (target && matchesRule(state, row.condition, state.repo))
            visit(target, true, [...ancestors, id]);
        } else chain.push({ ...row, included });
      }
    }
    visit("system");
    visit("global");
    visit(repos[state.repo].local);
    return chain;
  }
  // Deliberately bounded to the patterns accepted by the prototype form.
  // Production resolution must come from Git, including worktrees and symlinks.
  function glob(pattern, value, insensitive = false) {
    let source = "";
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (char === "*" && pattern[i + 1] === "*") {
        i++;
        if (pattern[i + 1] === "/") {
          source += "(?:.*/)?";
          i++;
        } else source += ".*";
      } else if (char === "*") source += "[^/]*";
      else if (char === "?") source += "[^/]";
      else source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`^${source}$`, insensitive ? "i" : "").test(value);
  }
  function includeFile(path) {
    return ["work", "personal"].find((id) => definitions[id].path === path);
  }
  function matchesRule(state, condition, repo) {
    const remotePrefix = "hasconfig:remote.*.url:";
    if (condition.startsWith(remotePrefix)) {
      const pattern = condition.slice(remotePrefix.length);
      return records(repos[repo].local, state.files[repos[repo].local])
        .filter((row) => row.key === "remote.url")
        .some((row) => glob(pattern, row.value));
    }
    const directory = condition.match(/^(gitdir(?:\/i)?):(.*)$/);
    if (!directory) return false;
    let pattern = directory[2];
    if (!/^(?:[A-Za-z]:\/|\/)/.test(pattern)) pattern = `**/${pattern}`;
    if (pattern.endsWith("/")) pattern += "**";
    return glob(
      pattern,
      definitions[repos[repo].local].path.replace(/\/config$/, ""),
      directory[1] === "gitdir/i",
    );
  }
  function includeRules(state) {
    return records("global", state.files.global).filter((row) => row.key === "includeif.path");
  }
  function ruleError(draft) {
    if (!["hasconfig:remote.*.url", "gitdir", "gitdir/i"].includes(draft.type))
      return "Choose a supported condition.";
    if (!draft.pattern.trim() || /[\r\n\0"\\[\]]/.test(draft.pattern))
      return "Use a pattern without quotes, backslashes, or character classes.";
    if (draft.pattern.split("/").some((part) => part.includes("**") && part !== "**"))
      return "Use ** as a complete path segment, for example example/**.";
    if (draft.type !== "hasconfig:remote.*.url" && !/^(?:[A-Za-z]:\/|\/)/.test(draft.pattern))
      return "Use an absolute folder path with forward slashes, for example E:/Projects/work-demo/.";
    if (!includeFile(draft.path)) return "Choose one of the sample include files.";
    return "";
  }
  function rulePreview(state, draft) {
    const error = ruleError(draft);
    if (error) return note({ ...state, plan: null }, "invalid-rule", "error", error, "");
    const beforeText = state.files.global;
    const row = draft.ordinal === null ? null : includeRules(state)[draft.ordinal];
    if (draft.ordinal !== null && !row)
      return note(
        { ...state, plan: null },
        "missing-rule",
        "error",
        "The rule is no longer present. Reopen the editor.",
        "",
      );
    const condition = `${draft.type}:${draft.pattern}`;
    const eol = beforeText.includes("\r\n") ? "\r\n" : "\n";
    const start = row ? row.sectionStart : beforeText.length;
    const end = row ? row.valueEnd : start;
    const beforeChunk = beforeText.slice(start, end);
    const afterChunk = row
      ? beforeChunk
          .replace(/(\[includeif\s+")(.*?)("\])/i, (_all, a, _old, b) => `${a}${condition}${b}`)
          .slice(0, -(row.valueEnd - row.valueStart)) + encoded(draft.path, row.raw)
      : `${beforeText.endsWith("\n") ? "" : eol}${eol}[includeIf "${condition}"]${eol}\tpath = ${encoded(draft.path, "")}${eol}`;
    const afterText = beforeText.slice(0, start) + afterChunk + beforeText.slice(end);
    const next = { ...state, files: { ...state.files, global: afterText } };
    const identityFor = (snapshot, repo) =>
      effective({ ...snapshot, kind: "git", repo, target: { key: "user.email" } });
    const impacts = Object.keys(repos).map((repo) => ({
      repo,
      matches: matchesRule(next, condition, repo),
      before: identityFor(state, repo),
      after: identityFor(next, repo),
    }));
    const selected = impacts.find((impact) => impact.repo === state.repo);
    return {
      ...state,
      plan: {
        kind: "rule",
        ruleDraft: copy(draft),
        target: {
          fileId: "global",
          key: "includeif.path",
          ordinal: draft.ordinal ?? includeRules(state).length,
        },
        beforeText,
        afterText,
        beforeChunk,
        afterChunk,
        start,
        line: row ? row.sectionIndex : lines(beforeText).length,
        endLine: lines(afterText.slice(0, start + afterChunk.length)).length - 1,
        beforeEffective: selected.before.summary,
        afterEffective: selected.after.summary,
        impacts,
      },
    };
  }
  function hostMatches(pattern, target) {
    let yes = false;
    for (const part of pattern.split(/\s+/)) {
      const negative = part.startsWith("!");
      const source = negative ? part.slice(1) : part;
      const regex = new RegExp(
        `^${source
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".")}$`,
        "i",
      );
      if (regex.test(target)) {
        if (negative) return false;
        yes = true;
      }
    }
    return yes;
  }
  function sshChain(state) {
    const chain = [];
    function visit(id) {
      for (const row of records(id, state.files[id])) {
        if (row.key === "include" && row.value === "config.d/work.conf") {
          visit("sshWork");
          continue;
        }
        if (row.key === "host" || row.key === "match" || row.key === "include") continue;
        if (row.block !== "match" && hostMatches(row.host, state.host)) chain.push(row);
      }
    }
    visit("ssh");
    return chain;
  }
  function effective(state) {
    if (state.kind === "git") {
      const chain = gitChain(state),
        email = chain.filter((r) => r.key === state.target.key),
        name = chain.filter((r) => r.key === "user.name");
      return {
        chain: email,
        summary: email.at(-1)?.value || "ไม่ได้ตั้งค่า",
        name: name.at(-1)?.value || "ไม่ได้ตั้งค่า",
        origin: email.at(-1)?.fileId || null,
      };
    }
    const chain = sshChain(state).filter((r) => r.key === "identityfile");
    return {
      chain,
      summary: chain.map((r) => r.value).join(" → ") || "ไม่มี IdentityFile ใน fixture",
      name: state.host,
      origin: chain[0]?.fileId || null,
    };
  }
  const targetFor = (kind, repo, host = "bitbucket.org") =>
    kind === "ssh"
      ? { fileId: host === "bitbucket.org" ? "sshWork" : "ssh", key: "identityfile", ordinal: 0 }
      : { fileId: repo === "personal" ? "repoPersonal" : "work", key: "user.email", ordinal: 0 };
  function initial(setup = {}) {
    const kind = setup.kind || "git",
      repo = setup.repo || "work";
    return {
      kind,
      repo,
      host: "bitbucket.org",
      files: Object.fromEntries(Object.entries(definitions).map(([id, f]) => [id, f.text])),
      target: setup.target || targetFor(kind, repo),
      draft:
        setup.draft || (kind === "ssh" ? "~/.ssh/id_work_new" : "updated@company.example.test"),
      plan: null,
      journal: null,
      seq: 0,
      events: [],
      outside: 0,
      result: {
        code: "ready",
        tone: "info",
        title: "เริ่มจากดูที่มาของค่า แล้วสร้าง preview",
        detail:
          kind === "git"
            ? "การเปลี่ยน global อาจไม่มีผล ถ้า repo ตั้ง local ทับไว้ การแก้ใน demo นี้ยังไม่แตะข้อมูลในเครื่อง"
            : "IdentityFile หลายรายการสะสมตามลำดับ เลือกแก้หนึ่งรายการโดยเก็บ include และบรรทัดอื่นไว้",
      },
    };
  }
  function note(state, code, tone, title, detail, logged = true) {
    const next = { ...state, result: { code, tone, title, detail } };
    if (logged) {
      next.seq++;
      next.events = [{ seq: next.seq, text: title }, ...state.events].slice(0, 16);
    }
    return next;
  }
  function preview(state) {
    const row = find(state, state.target),
      value = state.draft.trim();
    if (!row)
      return note(
        state,
        "missing",
        "error",
        "ไม่พบรายการเป้าหมาย",
        "เลือกไฟล์และรายการใหม่ก่อนสร้าง preview",
      );
    if (!value || /[\r\n\0]/.test(value))
      return note(
        state,
        "invalid",
        "error",
        "กรอกค่าในบรรทัดเดียว",
        "prototype นี้ทดลองการแก้ค่าที่มีอยู่แล้ว ไม่เพิ่ม directive หรือบรรทัดใหม่ผ่านช่องนี้",
      );
    const afterRaw = encoded(value, row.raw),
      beforeText = state.files[row.fileId],
      afterText = replacement(beforeText, row, afterRaw);
    if (beforeText === afterText)
      return note(
        { ...state, plan: null },
        "no-change",
        "warn",
        "ค่านี้เหมือนเดิม",
        "ยังไม่มีการเปลี่ยนแปลงให้ Apply",
      );
    const next = { ...state, files: { ...state.files, [row.fileId]: afterText } };
    const plan = {
      target: copy(state.target),
      beforeText,
      afterText,
      beforeRaw: row.raw,
      afterRaw,
      line: row.index,
      beforeLine: row.body,
      afterLine: row.body.slice(0, row.start) + afterRaw + row.body.slice(row.end),
      recordScope: { condition: row.condition || "", host: row.host || "", block: row.block || "" },
      recordCount: records(row.fileId, beforeText).filter((r) => r.key === row.key).length,
      beforeEffective: effective(state).summary,
      afterEffective: effective(next).summary,
    };
    return note(
      { ...state, plan },
      "preview",
      "info",
      "Preview พร้อมแล้ว ยังไม่มีไฟล์เปลี่ยน",
      "Apply จะตรวจว่าข้อความทั้งไฟล์ยังตรงกับ snapshot นี้ก่อนแก้เฉพาะค่า",
    );
  }
  function reduce(state, action) {
    if (["kind", "repo", "host"].includes(action.type)) {
      const next = { ...state, [action.type]: action.value, plan: null };
      next.target = targetFor(next.kind, next.repo, next.host);
      next.draft = next.kind === "ssh" ? "~/.ssh/id_work_new" : "updated@company.example.test";
      return note(
        next,
        "context",
        "info",
        "เปลี่ยนบริบทแล้ว โดยเก็บไฟล์จำลองเดิมไว้",
        "สร้าง preview ใหม่สำหรับบริบทนี้ หรือกดเริ่มเคสใหม่เมื่อต้องการใช้ข้อมูลตั้งต้น",
      );
    }
    if (action.type === "target")
      return note(
        { ...state, target: action.target, plan: null },
        "draft",
        "info",
        "เลือกตำแหน่งที่จะแก้แล้ว",
        "ค่าในช่องแก้ไขจะถูกใช้เฉพาะรายการนี้ สร้าง preview เพื่อดูผล",
        false,
      );
    if (action.type === "draft") return { ...state, draft: action.value, plan: null };
    if (action.type === "rule-preview") return rulePreview(state, action.draft);
    if (action.type === "preview")
      return state.plan?.kind === "rule"
        ? rulePreview(state, state.plan.ruleDraft)
        : preview(state);
    if (action.type === "apply") {
      const p = state.plan;
      if (!p)
        return note(state, "no-preview", "warn", "สร้าง preview ก่อน Apply", "ไม่มีการเปลี่ยนข้อมูลจำลอง");
      if (state.files[p.target.fileId] !== p.beforeText)
        return note(
          state,
          "stale",
          "error",
          "หยุด Apply: ไฟล์ถูกแก้หลัง preview",
          "ยังไม่เขียนอะไร สร้าง preview ใหม่เพื่ออ่านไฟล์ล่าสุดและตรวจการเปลี่ยนแปลงอีกครั้ง",
        );
      const next = {
        ...state,
        files: { ...state.files, [p.target.fileId]: p.afterText },
        journal: { ...copy(p), status: "applied", id: state.seq + 1 },
        plan: null,
      };
      const unchanged = p.beforeEffective === p.afterEffective;
      return note(
        next,
        "applied",
        unchanged ? "warn" : "info",
        "Apply แล้ว: เปลี่ยนเฉพาะค่าที่เลือก",
        unchanged
          ? state.kind === "git"
            ? "ไฟล์เปลี่ยน แต่ค่าที่มีผลใน repo ยังเหมือนเดิม ดูลำดับการทับค่าและเงื่อนไข include"
            : "ไฟล์เปลี่ยน แต่ Host ที่เลือกไม่ได้อ้างรายการนี้"
          : "comments, ค่าซ้ำ, บรรทัดอื่น และ line endings คงเดิมตาม source spans ของ fixture",
      );
    }
    if (action.type === "undo") {
      const j = state.journal;
      if (j?.status !== "applied")
        return note(
          state,
          "no-undo",
          "warn",
          "ยังไม่มี Apply ที่ย้อนกลับได้",
          "Undo ใช้ได้กับการ Apply ล่าสุดที่ยังไม่ได้ย้อน",
        );
      if (j.kind === "rule") {
        const text = state.files.global;
        const start = text === j.afterText ? j.start : text.indexOf(j.afterChunk);
        if (start < 0 || (text !== j.afterText && text.indexOf(j.afterChunk, start + 1) !== -1))
          return note(
            state,
            "undo-conflict",
            "error",
            "The include rule changed or is ambiguous. Current file kept.",
            "",
          );
        return note(
          {
            ...state,
            files: {
              ...state.files,
              global:
                text.slice(0, start) + j.beforeChunk + text.slice(start + j.afterChunk.length),
            },
            journal: { ...j, status: "undone" },
            plan: null,
          },
          "undone",
          "info",
          "Include rule undone. Other edits kept.",
          "",
        );
      }
      const text = state.files[j.target.fileId],
        all = records(j.target.fileId, text).filter((r) => r.key === j.target.key),
        row = all[j.target.ordinal || 0];
      const scopeOf = (r) => ({
        condition: r.condition || "",
        host: r.host || "",
        block: r.block || "",
      });
      const sameScope = (r) => JSON.stringify(scopeOf(r)) === JSON.stringify(j.recordScope);
      const unambiguous =
        text === j.afterText ||
        all.filter((r) => r.body === j.afterLine && sameScope(r)).length === 1;
      if (
        all.length !== j.recordCount ||
        !row ||
        row.body !== j.afterLine ||
        !sameScope(row) ||
        !unambiguous
      )
        return note(
          state,
          "undo-conflict",
          "error",
          "หยุด Undo: รายการที่เราแก้ถูกเปลี่ยนแล้ว",
          "เก็บไฟล์ปัจจุบันไว้ ไม่คืน snapshot ทั้งไฟล์ เพื่อไม่ลบการแก้ของโปรแกรมอื่น",
        );
      const reverted = replacement(text, row, j.beforeRaw);
      return note(
        {
          ...state,
          files: { ...state.files, [j.target.fileId]: reverted },
          journal: { ...j, status: "undone" },
          plan: null,
        },
        "undone",
        "info",
        "Undo แล้ว: ย้อนเฉพาะค่าของเรา",
        "ข้อมูลอื่นที่ถูกเพิ่มหรือแก้ภายหลังยังอยู่ในไฟล์",
      );
    }
    if (action.type === "outside-unrelated") {
      const id =
        state.plan?.target.fileId ||
        (state.journal?.status === "applied" ? state.journal.target.fileId : state.target.fileId);
      const eol = state.files[id].includes("\r\n") ? "\r\n" : "\n";
      const extra =
        definitions[id].kind === "git"
          ? `# Added by another app ${state.outside + 1}${eol}[alias]${eol}\tst${state.outside + 1} = status -sb${eol}`
          : `# Added by another app ${state.outside + 1}${eol}Host staging-${state.outside + 1}${eol}\tHostName staging.example.test${eol}`;
      return note(
        {
          ...state,
          outside: state.outside + 1,
          files: { ...state.files, [id]: state.files[id] + eol + extra },
        },
        "external",
        "warn",
        "โปรแกรมอื่นเพิ่มข้อมูลคนละรายการแล้ว",
        "preview เดิมไม่ถูกอัปเดต ถ้า Apply ต้องอ่านใหม่ก่อน; หลัง Apply แล้ว Undo จะเก็บข้อมูลที่เพิ่มนี้ไว้",
      );
    }
    if (action.type === "outside-same") {
      const target =
          state.plan?.target ||
          (state.journal?.status === "applied" ? state.journal.target : state.target),
        row = find(state, target);
      if (!row) return reduce(state, { type: "outside-unrelated" });
      const value =
        definitions[target.fileId].kind === "ssh"
          ? `~/.ssh/id_external_${state.outside + 1}`
          : `outside-${state.outside + 1}@example.test`;
      return note(
        {
          ...state,
          outside: state.outside + 1,
          files: {
            ...state.files,
            [target.fileId]: replacement(state.files[target.fileId], row, encoded(value, row.raw)),
          },
        },
        "external-same",
        "warn",
        "โปรแกรมอื่นแก้รายการเดียวกันแล้ว",
        "Apply ที่ใช้ preview เก่าหรือ Undo ของค่าที่ไม่ตรงเดิมต้องหยุด โดยไม่ทับไฟล์ปัจจุบัน",
      );
    }
    return state;
  }
  function metadata(text) {
    const crlf = (text.match(/\r\n/g) || []).length,
      lf = (text.match(/(?<!\r)\n/g) || []).length,
      cr = (text.match(/\r(?!\n)/g) || []).length;
    return {
      crlf,
      lf,
      cr,
      bom: text.startsWith("\uFEFF"),
      bytes: new TextEncoder().encode(text).length,
    };
  }
  return {
    definitions,
    repos,
    initial,
    reduce,
    records,
    find,
    lines,
    effective,
    metadata,
    targetFor,
    includeRules,
    matchesRule,
    ruleError,
  };
})();

export default ConfigPrototype;
