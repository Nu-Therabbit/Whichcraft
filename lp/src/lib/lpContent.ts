export const GITHUB_URL = 'https://github.com/Nu-Therabbit/Whichcraft';
export const RELEASE_URL = 'https://github.com/Nu-Therabbit/Whichcraft/releases/latest';
export const STORYBOOK_URL = '/Whichcraft/storybook/';
export const REPORTS_URL = '/Whichcraft/reports/';
export const VERSION = '0.1.0';

export type LandingLang = 'en' | 'ja' | 'zh-CN' | 'ru' | 'ko' | 'vi';

export const LANGUAGES: Array<{ code: LandingLang; path: string; label: string }> = [
  { code: 'en', path: '/Whichcraft/', label: 'English' },
  { code: 'ja', path: '/Whichcraft/ja/', label: '日本語' },
  { code: 'zh-CN', path: '/Whichcraft/zh-cn/', label: '简体中文' },
  { code: 'ru', path: '/Whichcraft/ru/', label: 'Русский' },
  { code: 'ko', path: '/Whichcraft/ko/', label: '한국어' },
  { code: 'vi', path: '/Whichcraft/vi/', label: 'Tiếng Việt' },
];

export type LandingCopy = {
  lang: LandingLang;
  title: string;
  description: string;
  ogDescription: string;
  canonicalPath: string;
  nav: {
    features: string;
    storybook: string;
    reports: string;
    download: string;
  };
  hero: {
    eyebrow: string;
    lead: string;
    download: string;
    github: string;
  };
  screenshots: {
    toolsAlt: string;
    planAlt: string;
    profilesAlt: string;
    firstLabel: string;
    secondLabel: string;
    thirdLabel: string;
    prevLabel: string;
    nextLabel: string;
  };
  featuresHeading: string;
  featuresLead: string;
  features: Array<{
    icon: string;
    title: string;
    desc: string;
  }>;
  otherFeaturesHeading: string;
  otherFeatures: Array<{
    icon: string;
    title: string;
    desc: string;
  }>;
  audience: {
    heading: string;
    paragraphs: string[];
  };
  stack: {
    label: string;
    items: string[];
  };
  privacyNote: string;
  faq: {
    heading: string;
    items: Array<{ id: string; question: string; answer: string }>;
    cliSetup: string;
    cliDocs: string;
  };
  footer: {
    copyright: string;
    releases: string;
    license: string;
  };
};

export const enCopy: LandingCopy = {
  faq: {
    heading: 'Frequently asked questions',
    items: [
      {
        id: 'tools',
        question: 'Which developer tools does Whichcraft manage?',
        answer: 'You can switch between installations of Java, Node.js, Python, Go, Flutter, and Git. Whichcraft can also install, update, and uninstall Java (Temurin), Node.js, Python, Go, and Flutter; Git is switch-only. Android SDK and NDK, MSVC, and the Windows SDK are shown for reference and cannot be changed from the app.',
      },
      {
        id: 'switching',
        question: 'How does switching work? Does it use shims or per-project versions?',
        answer: 'Whichcraft writes the path of the installation you choose straight into your Windows environment, with no shims. The choice applies to the whole machine and not to a single project, so every new process gets the same version. Per-project versions are out of scope.',
      },
      {
        id: 'existing',
        question: 'Will it touch the tools I have already installed?',
        answer: 'Installations it finds stay where they are, and their original installer keeps owning the files. If you uninstall one, Whichcraft opens its registered uninstaller, or moves a plain folder to the Recycle Bin after you confirm. It refuses when the folder is in use or is not clearly that tool.',
      },
      {
        id: 'mise',
        question: 'Do I need to install mise first?',
        answer: 'No. The first time it is needed, Whichcraft downloads a pinned version of mise and checks its hash. It uses its own data folder and config, separate from any mise you already run. Tools it installs go into an install folder you choose, and nothing on PATH changes until you select one.',
      },
      {
        id: 'admin',
        question: 'Can I use Whichcraft without administrator privileges?',
        answer: 'Yes. Switching normally writes only to your User environment. When a System entry is in the way, or you change System variables, Whichcraft shows the diff, warns that this affects every user on the PC, and asks for UAC approval.',
      },
      {
        id: 'terminal',
        question: 'Why does my open terminal still run the old version?',
        answer: 'A running process keeps the environment it started with. Use Open terminal in Whichcraft for a shell with a freshly built environment, or restart the terminal and the app that launched it, such as your editor. If a shell still runs something else, Check in shell shows whether its profile changes PATH.',
      },
      {
        id: 'cli',
        question: 'Can I use Whichcraft from the command line or scripts?',
        answer: 'For environment variables, yes. get, list, and export read them, while set, delete, and import change them. Write commands default to a dry run and only modify the registry when you add --apply. Switching and installing tools are done in the app. Run whichcraft --help to see the commands and options.',
      },
      {
        id: 'uninstall',
        question: 'What stays on my PC after I uninstall Whichcraft?',
        answer: 'The app, its shortcuts, and its PATH entry are removed. Tools you installed through Whichcraft stay in place, because PATH or a project may still use them, so remove them in the app first if you no longer want them. With the .exe installer, tick Delete the application data to also remove settings, profiles, snapshots, and undo history. The MSI has no such option and keeps them.',
      },
    ],
    cliSetup: 'Run these commands from a terminal. Add Whichcraft to PATH using the app, or invoke bin\\whichcraft.exe in the installation folder by its full path.',
    cliDocs: 'CLI usage and examples',
  },
  lang: 'en',
  title: 'Whichcraft — Developer Tool Manager for Windows',
  description: 'Find, install, switch, and uninstall versions of Java, Node.js, Python, Go, Flutter, and Git on Windows, and review every environment change before it applies. Free and open source for Windows 10/11.',
  ogDescription: 'Find, install, switch, and uninstall versions of Java, Node.js, Python, Go, Flutter, and Git on Windows, and review every environment change before it applies. Free and open source for Windows 10/11.',
  canonicalPath: '/Whichcraft/',
  nav: {
    features: 'Features',
    storybook: 'Storybook',
    reports: 'Reports',
    download: 'Download',
  },
  hero: {
    eyebrow: `Developer Tool Manager for Windows · v${VERSION}`,
    lead: 'See every version of your developer tools in one place, and decide which one Windows runs. Review the exact PATH changes before you apply them, and undo them if you change your mind.',
    download: `Download v${VERSION} for Windows`,
    github: 'View on GitHub →',
  },
  screenshots: {
    toolsAlt: 'Whichcraft — developer tools overview showing the effective version of Java, Node.js, Python, Go, Flutter, and Git',
    planAlt: 'Whichcraft — apply plan dialog showing the JAVA_HOME change before it is written',
    profilesAlt: 'Whichcraft — tool profiles showing which saved set matches what is in effect',
    firstLabel: 'Screenshot 1',
    secondLabel: 'Screenshot 2',
    thirdLabel: 'Screenshot 3',
    prevLabel: 'Previous screenshot',
    nextLabel: 'Next screenshot',
  },
  featuresHeading: 'Features',
  featuresLead: 'Everything you need to run the right version of each tool.',
  features: [
    {
      icon: '⌕',
      title: 'Find what is installed',
      desc: 'Searches PATH, the registry, standard locations, and folders you add. Each installation shows its vendor, version, location, and what installed it.',
    },
    {
      icon: '⇄',
      title: 'Switch with a reviewed plan',
      desc: 'Pick an installation and see the exact JAVA_HOME and PATH changes first. Paths are written directly with no shims, and nothing changes until you click Apply.',
    },
    {
      icon: '↓',
      title: 'Install and update',
      desc: 'Install Temurin, Node.js, Python, Go, and Flutter from the app. An update installs next to the old version, switches to it, then offers to remove the old one.',
    },
    {
      icon: '☰',
      title: 'Tool profiles',
      desc: 'Save named sets such as Java 17 with Node 20, then apply them in one step. Tools left out of a profile keep their current version.',
    },
  ],
  otherFeaturesHeading: 'Also included',
  otherFeatures: [
    {
      icon: '◎',
      title: 'What really runs',
      desc: 'Shows the installation a new process actually gets from the registry, and tells you when that differs from what you selected.',
    },
    {
      icon: '>_',
      title: 'Check in shell',
      desc: 'Runs your configured shell with its profile loaded and tells you when a profile or alias sends a command somewhere else.',
    },
    {
      icon: '↩',
      title: 'Undo and recovery',
      desc: 'Undo reverts only what Whichcraft changed and reports conflicts. If an apply is interrupted, the next launch shows what was written so you can finish or roll back.',
    },
    {
      icon: '✕',
      title: 'Careful uninstall',
      desc: 'Lists programs still using an installation, asks what to switch to first, and offers to update any profiles that point at it.',
    },
    {
      icon: '⠿',
      title: 'PATH cleanup',
      desc: 'Finds duplicate and missing entries in your User PATH. Removals go through the same reviewed plan and Undo as any other change.',
    },
    {
      icon: '▶',
      title: 'Open a fresh terminal',
      desc: 'Opens Windows Terminal, PowerShell, or Command Prompt with an environment rebuilt from the registry, so it runs what you just selected.',
    },
    {
      icon: '▤',
      title: 'SDK inventory',
      desc: 'Shows Android SDK and NDK components, MSVC toolsets, and Windows SDKs in one view. Keep managing them with Android Studio and Visual Studio.',
    },
    {
      icon: '≡',
      title: 'Environment workspace',
      desc: 'Edit User and System variables with diffs, secret detection, encrypted snapshots, import and export, and a command lookup.',
    },
  ],
  audience: {
    heading: 'Who is it for?',
    paragraphs: [
      'Whichcraft is for developers on Windows 10 and 11 who keep several versions of their tools side by side and want a clear view of what is on the machine, without shims or hand-editing environment variables.',
      'Whether you are moving between Java 17 and 21 for different services, finding out why a terminal runs the wrong Node.js, or clearing out old SDKs, Whichcraft shows what will change before it changes.',
    ],
  },
  stack: {
    label: 'Built with',
    items: ['Tauri v2', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Rust'],
  },
  privacyNote: 'No telemetry. The app goes online only to check GitHub for new versions and to fetch the tools you choose to install, along with the pinned mise it uses to install them.',
  footer: {
    copyright: '© 2026 Whichcraft · MIT License',
    releases: 'Releases',
    license: 'License',
  },
};

export const jaCopy: LandingCopy = {
  faq: {
    heading: 'よくある質問',
    items: [
      {
        id: 'tools',
        question: 'Whichcraft で管理できる開発ツールは何ですか？',
        answer: 'Java、Node.js、Python、Go、Flutter、Git のインストールを切り替えられます。Java (Temurin)、Node.js、Python、Go、Flutter はインストール、更新、アンインストールにも対応し、Git は切り替えのみです。Android SDK と NDK、MSVC、Windows SDK は参照用の表示で、アプリからは変更できません。',
      },
      {
        id: 'switching',
        question: '切り替えの仕組みは？ シムやプロジェクトごとのバージョンを使いますか？',
        answer: 'Whichcraft は、選んだインストールのパスをシムを介さず Windows の環境変数に直接書き込みます。選択はプロジェクト単位ではなくマシン全体に適用され、新しいプロセスはすべて同じバージョンを使います。プロジェクトごとのバージョン管理は対象外です。',
      },
      {
        id: 'existing',
        question: 'すでにインストール済みのツールに影響はありますか？',
        answer: '検出したインストールはそのままの場所に残り、ファイルの管理も元のインストーラーのままです。アンインストールする場合は、登録済みのアンインストーラーを開くか、確認のうえでフォルダーをごみ箱に移動します。使用中のフォルダーや、そのツールだと判断できないフォルダーは削除しません。',
      },
      {
        id: 'mise',
        question: '先に mise をインストールする必要はありますか？',
        answer: 'いいえ。必要になった時点で、Whichcraft が固定バージョンの mise をダウンロードしてハッシュを確認します。データフォルダーと設定はお使いの mise とは別です。ツールは選択したインストール先に入り、選択するまで PATH は変わりません。',
      },
      {
        id: 'admin',
        question: '管理者権限なしでも使えますか？',
        answer: 'はい。通常の切り替えでは User 環境変数だけに書き込みます。System 側のエントリが優先される場合や System 変数を変更する場合は、差分を表示し、PC のすべてのユーザーに影響することを警告したうえで UAC の承認を求めます。',
      },
      {
        id: 'terminal',
        question: '開いているターミナルで古いバージョンが動くのはなぜですか？',
        answer: '実行中のプロセスは、起動時の環境変数を保持しているためです。Whichcraft の「ターミナルを開く」を使うと環境変数を作り直したシェルが開きます。または、ターミナルとその起動元のエディターなどを再起動してください。それでも別のものが動く場合は、「シェルで確認」でプロファイルが PATH を変更していないか確認できます。',
      },
      {
        id: 'cli',
        question: 'Whichcraft をコマンドラインやスクリプトから使えますか？',
        answer: '環境変数については使えます。読み取り用の get・list・export と、変更用の set・delete・import があります。変更用コマンドは既定ではドライランになり、--apply を付けたときだけレジストリへ書き込みます。ツールの切り替えとインストールはアプリで行います。whichcraft --help でコマンドとオプションを確認できます。',
      },
      {
        id: 'uninstall',
        question: 'Whichcraft をアンインストールすると PC に何が残りますか？',
        answer: 'アプリ、ショートカット、PATH のエントリは削除されます。Whichcraft でインストールしたツールは、PATH やプロジェクトが使っている可能性があるため残ります。不要な場合は先にアプリから削除してください。.exe インストーラーでアプリケーションデータを削除するオプションを選ぶと、設定、プロファイル、スナップショット、元に戻す履歴も削除されます。MSI にはこのオプションがなく、これらは残ります。',
      },
    ],
    cliSetup: 'ターミナルから実行してください。アプリで Whichcraft を PATH に追加するか、インストール先の bin\\whichcraft.exe をフルパスで指定します。',
    cliDocs: 'CLI の使い方と実行例',
  },
  lang: 'ja',
  title: 'Whichcraft — Windows 向け開発ツールマネージャー',
  description: 'Windows で Java、Node.js、Python、Go、Flutter、Git の各バージョンを検出、インストール、切り替え、アンインストール。環境変数の変更は適用前に必ず確認できます。Windows 10/11 向けの無料オープンソースアプリです。',
  ogDescription: 'Windows で Java、Node.js、Python、Go、Flutter、Git の各バージョンを検出、インストール、切り替え、アンインストール。環境変数の変更は適用前に必ず確認できます。Windows 10/11 向けの無料オープンソースアプリです。',
  canonicalPath: '/Whichcraft/ja/',
  nav: {
    features: '機能',
    storybook: 'Storybook',
    reports: 'Reports',
    download: 'ダウンロード',
  },
  hero: {
    eyebrow: `Windows 向け開発ツールマネージャー · v${VERSION}`,
    lead: '開発ツールの全バージョンを一か所で確認し、Windows で使うものを決められます。PATH の変更内容を適用前に確認でき、気が変わったら元に戻せます。',
    download: `Windows 版 v${VERSION} をダウンロード`,
    github: 'GitHub で見る →',
  },
  screenshots: {
    toolsAlt: 'Whichcraft — Java、Node.js、Python、Go、Flutter、Git の有効なバージョンを表示する開発ツール一覧',
    planAlt: 'Whichcraft — 書き込み前の JAVA_HOME の変更を示す適用プランのダイアログ',
    profilesAlt: 'Whichcraft — 保存したセットが現在の状態と一致するかを示すツールプロファイル',
    firstLabel: 'スクリーンショット 1',
    secondLabel: 'スクリーンショット 2',
    thirdLabel: 'スクリーンショット 3',
    prevLabel: '前のスクリーンショット',
    nextLabel: '次のスクリーンショット',
  },
  featuresHeading: '機能',
  featuresLead: '各ツールの正しいバージョンを使うために必要なものをひとまとめに。',
  features: [
    {
      icon: '⌕',
      title: 'インストール済みのものを検出',
      desc: 'PATH、レジストリ、標準の場所、追加したフォルダーを検索します。各インストールのベンダー、バージョン、場所、インストール元を表示します。',
    },
    {
      icon: '⇄',
      title: 'プランを確認して切り替え',
      desc: 'インストールを選ぶと、JAVA_HOME と PATH の変更内容を先に確認できます。パスはシムなしで直接書き込まれ、Apply を押すまで何も変わりません。',
    },
    {
      icon: '↓',
      title: 'インストールと更新',
      desc: 'Temurin、Node.js、Python、Go、Flutter をアプリからインストール。更新は古いバージョンの隣にインストールして切り替え、その後で古いものの削除を提案します。',
    },
    {
      icon: '☰',
      title: 'ツールプロファイル',
      desc: 'Java 17 と Node 20 のような組み合わせに名前を付けて保存し、まとめて適用できます。プロファイルにないツールは現在のバージョンのままです。',
    },
  ],
  otherFeaturesHeading: 'そのほかの機能',
  otherFeatures: [
    {
      icon: '◎',
      title: '実際に動くものを表示',
      desc: '新しいプロセスがレジストリから実際に受け取るインストールを表示し、選択と異なる場合は知らせます。',
    },
    {
      icon: '>_',
      title: 'シェルで確認',
      desc: '設定したシェルをプロファイル付きで実行し、プロファイルやエイリアスがコマンドを別の場所へ向けている場合に知らせます。',
    },
    {
      icon: '↩',
      title: '元に戻すと復旧',
      desc: '元に戻す操作は Whichcraft が変更した分だけを戻し、競合があれば報告します。適用が中断された場合は、次回起動時に書き込まれた内容を表示し、完了かロールバックを選べます。',
    },
    {
      icon: '✕',
      title: '慎重なアンインストール',
      desc: 'インストールを使用中のプログラムを一覧表示し、先に切り替える先を確認します。それを参照するプロファイルの更新も提案します。',
    },
    {
      icon: '⠿',
      title: 'PATH の整理',
      desc: 'User PATH の重複と存在しないエントリを見つけます。削除は他の変更と同じく、確認付きのプランと元に戻す操作に対応します。',
    },
    {
      icon: '▶',
      title: '新しいターミナルを開く',
      desc: 'レジストリから環境変数を作り直して Windows Terminal、PowerShell、コマンドプロンプトを開くので、選択したものがそのまま動きます。',
    },
    {
      icon: '▤',
      title: 'SDK の一覧',
      desc: 'Android SDK と NDK のコンポーネント、MSVC ツールセット、Windows SDK をまとめて表示します。管理は引き続き Android Studio と Visual Studio で行います。',
    },
    {
      icon: '≡',
      title: '環境変数ワークスペース',
      desc: 'User と System の変数を、差分表示、シークレット検出、暗号化スナップショット、インポートとエクスポート、コマンド検索とともに編集できます。',
    },
  ],
  audience: {
    heading: '誰のためのアプリ？',
    paragraphs: [
      'Whichcraft は、Windows 10 / 11 で複数バージョンのツールを併用する開発者向けです。シムや環境変数の手作業なしで、マシンに何があるかをはっきり把握できます。',
      'サービスごとに Java 17 と 21 を行き来するとき、ターミナルが違う Node.js を動かす原因を探すとき、古い SDK を片付けるとき。Whichcraft は変更前に、何が変わるかを示します。',
    ],
  },
  stack: {
    label: 'Built with',
    items: ['Tauri v2', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Rust'],
  },
  privacyNote: 'テレメトリはありません。アプリが通信するのは、GitHub での新バージョン確認と、選択したツールおよびそのインストールに使う固定バージョンの mise の取得だけです。',
  footer: {
    copyright: '© 2026 Whichcraft · MIT License',
    releases: 'リリース',
    license: 'ライセンス',
  },
};

export const zhCNCopy: LandingCopy = {
  faq: {
    heading: '常见问题',
    items: [
      {
        id: 'tools',
        question: 'Whichcraft 可以管理哪些开发工具？',
        answer: '可以在 Java、Node.js、Python、Go、Flutter 和 Git 的不同安装之间切换。Java (Temurin)、Node.js、Python、Go 和 Flutter 还支持安装、更新和卸载；Git 只支持切换。Android SDK 和 NDK、MSVC 以及 Windows SDK 仅供查看，不能在应用中更改。',
      },
      {
        id: 'switching',
        question: '切换是如何实现的？会使用 shim 或按项目区分版本吗？',
        answer: 'Whichcraft 会把所选安装的路径直接写入 Windows 环境变量，不使用 shim。选择对整台电脑生效，而不是针对单个项目，因此所有新进程都使用同一版本。按项目区分版本不在支持范围内。',
      },
      {
        id: 'existing',
        question: '它会改动我已经安装的工具吗？',
        answer: '检测到的安装会留在原位，文件仍归原安装程序所有。卸载时，Whichcraft 会打开已注册的卸载程序，或在你确认后把普通文件夹移到回收站。如果文件夹正在使用，或无法确定它属于该工具，则会拒绝操作。',
      },
      {
        id: 'mise',
        question: '需要先安装 mise 吗？',
        answer: '不需要。首次用到时，Whichcraft 会下载固定版本的 mise 并校验哈希。它使用独立的数据文件夹和配置，与你自己的 mise 互不影响。工具会安装到你选择的文件夹，在你选中之前 PATH 不会改变。',
      },
      {
        id: 'admin',
        question: '没有管理员权限也能使用 Whichcraft 吗？',
        answer: '可以。通常切换只写入用户环境变量。如果系统条目造成遮挡，或需要修改系统变量，Whichcraft 会显示差异，提醒这会影响电脑上的所有用户，并请求 UAC 批准。',
      },
      {
        id: 'terminal',
        question: '为什么已打开的终端仍在运行旧版本？',
        answer: '运行中的进程会保留启动时的环境。使用 Whichcraft 的“打开终端”可以获得环境重新生成的 shell，或者重新启动终端及启动它的应用，例如编辑器。如果 shell 仍运行其他版本，“在 shell 中检查”可以显示其配置文件是否修改了 PATH。',
      },
      {
        id: 'cli',
        question: '可以从命令行或脚本使用 Whichcraft 吗？',
        answer: '环境变量可以。get、list 和 export 用于读取，set、delete 和 import 用于修改。修改命令默认为试运行，只有添加 --apply 才会写入注册表。切换和安装工具需要在应用中完成。运行 whichcraft --help 可查看命令和选项。',
      },
      {
        id: 'uninstall',
        question: '卸载 Whichcraft 后电脑上还会留下什么？',
        answer: '应用、快捷方式和 PATH 条目会被移除。通过 Whichcraft 安装的工具会保留，因为 PATH 或项目可能仍在使用；如果不再需要，请先在应用中卸载。使用 .exe 安装程序时，勾选删除应用数据的选项，还会移除设置、配置、快照和撤销记录。MSI 没有此选项，这些内容会保留。',
      },
    ],
    cliSetup: '请在终端中运行。通过应用将 Whichcraft 添加到 PATH，或使用安装目录中 bin\\whichcraft.exe 的完整路径。',
    cliDocs: 'CLI 用法和示例',
  },
  lang: 'zh-CN',
  title: 'Whichcraft — Windows 开发工具管理器',
  description: '在 Windows 上查找、安装、切换和卸载 Java、Node.js、Python、Go、Flutter 和 Git 的各个版本，并在应用前查看每一处环境更改。免费开源，适用于 Windows 10/11。',
  ogDescription: '在 Windows 上查找、安装、切换和卸载 Java、Node.js、Python、Go、Flutter 和 Git 的各个版本，并在应用前查看每一处环境更改。免费开源，适用于 Windows 10/11。',
  canonicalPath: '/Whichcraft/zh-cn/',
  nav: {
    features: '功能',
    storybook: 'Storybook',
    reports: '报告',
    download: '下载',
  },
  hero: {
    eyebrow: `Windows 开发工具管理器 · v${VERSION}`,
    lead: '在一处查看开发工具的所有版本，并决定 Windows 运行哪一个。应用前可以查看确切的 PATH 更改，改变主意时也能撤销。',
    download: `下载 Windows 版 v${VERSION}`,
    github: '在 GitHub 上查看 →',
  },
  screenshots: {
    toolsAlt: 'Whichcraft — 显示 Java、Node.js、Python、Go、Flutter 和 Git 实际生效版本的开发工具总览',
    planAlt: 'Whichcraft — 写入前显示 JAVA_HOME 更改的应用计划对话框',
    profilesAlt: 'Whichcraft — 显示已保存组合是否与当前生效版本一致的工具配置',
    firstLabel: '截图 1',
    secondLabel: '截图 2',
    thirdLabel: '截图 3',
    prevLabel: '上一张截图',
    nextLabel: '下一张截图',
  },
  featuresHeading: '功能',
  featuresLead: '让每个工具都运行正确版本所需的一切。',
  features: [
    {
      icon: '⌕',
      title: '查找已安装的工具',
      desc: '搜索 PATH、注册表、标准位置和你添加的文件夹。每个安装都会显示供应商、版本、位置以及安装来源。',
    },
    {
      icon: '⇄',
      title: '先查看计划再切换',
      desc: '选择一个安装后，先查看确切的 JAVA_HOME 和 PATH 更改。路径直接写入，不使用 shim，点击 Apply 之前不会有任何改变。',
    },
    {
      icon: '↓',
      title: '安装和更新',
      desc: '在应用中安装 Temurin、Node.js、Python、Go 和 Flutter。更新会把新版本装在旧版本旁边并切换过去，然后询问是否移除旧版本。',
    },
    {
      icon: '☰',
      title: '工具配置',
      desc: '保存命名组合，例如 Java 17 搭配 Node 20，一步应用。配置中未包含的工具保持当前版本。',
    },
  ],
  otherFeaturesHeading: '还包括',
  otherFeatures: [
    {
      icon: '◎',
      title: '实际运行的版本',
      desc: '显示新进程实际从注册表获得的安装，并在它与你的选择不一致时提示。',
    },
    {
      icon: '>_',
      title: '在 shell 中检查',
      desc: '加载配置文件运行你设置的 shell，并在配置文件或别名让命令指向其他位置时提示。',
    },
    {
      icon: '↩',
      title: '撤销与恢复',
      desc: '撤销只还原 Whichcraft 所做的更改，并报告冲突。如果应用被中断，下次启动时会显示已写入的内容，你可以继续完成或回滚。',
    },
    {
      icon: '✕',
      title: '谨慎卸载',
      desc: '列出仍在使用该安装的程序，先询问要切换到哪个安装，并建议更新指向它的配置。',
    },
    {
      icon: '⠿',
      title: 'PATH 清理',
      desc: '查找用户 PATH 中重复和不存在的条目。移除操作与其他更改一样，经过计划审查并可撤销。',
    },
    {
      icon: '▶',
      title: '打开全新终端',
      desc: '使用从注册表重新生成的环境打开 Windows Terminal、PowerShell 或命令提示符，运行的正是你刚选择的版本。',
    },
    {
      icon: '▤',
      title: 'SDK 清单',
      desc: '集中显示 Android SDK 和 NDK 组件、MSVC 工具集以及 Windows SDK。仍通过 Android Studio 和 Visual Studio 管理它们。',
    },
    {
      icon: '≡',
      title: '环境变量工作区',
      desc: '编辑用户和系统变量，并提供差异对比、敏感信息检测、加密快照、导入导出和命令查询。',
    },
  ],
  audience: {
    heading: '适合谁使用？',
    paragraphs: [
      'Whichcraft 面向在 Windows 10 / 11 上同时保留多个工具版本的开发者。无需 shim，也无需手动编辑环境变量，就能清楚了解电脑上有什么。',
      '无论是为不同服务在 Java 17 和 21 之间切换，查明终端为何运行了错误的 Node.js，还是清理旧 SDK，Whichcraft 都会在更改之前告诉你会发生什么。',
    ],
  },
  stack: {
    label: 'Built with',
    items: ['Tauri v2', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Rust'],
  },
  privacyNote: '没有遥测。应用只会联网向 GitHub 检查新版本，以及获取你选择安装的工具和安装它们所用的固定版本 mise。',
  footer: {
    copyright: '© 2026 Whichcraft · MIT License',
    releases: '发行版',
    license: '许可证',
  },
};

export const ruCopy: LandingCopy = {
  faq: {
    heading: 'Частые вопросы',
    items: [
      {
        id: 'tools',
        question: 'Какими инструментами разработки управляет Whichcraft?',
        answer: 'Можно переключаться между установками Java, Node.js, Python, Go, Flutter и Git. Для Java (Temurin), Node.js, Python, Go и Flutter также доступны установка, обновление и удаление; Git можно только переключать. Android SDK и NDK, MSVC и Windows SDK показываются для справки и не изменяются из приложения.',
      },
      {
        id: 'switching',
        question: 'Как работает переключение? Используются ли шимы или версии для отдельных проектов?',
        answer: 'Whichcraft записывает путь выбранной установки прямо в окружение Windows, без шимов. Выбор действует на весь компьютер, а не на отдельный проект, поэтому все новые процессы получают одну и ту же версию. Версии для отдельных проектов не поддерживаются.',
      },
      {
        id: 'existing',
        question: 'Затронет ли приложение уже установленные инструменты?',
        answer: 'Найденные установки остаются на месте, и их файлами по-прежнему владеет исходный установщик. При удалении Whichcraft открывает зарегистрированный деинсталлятор или, после подтверждения, перемещает обычную папку в корзину. Если папка используется или нельзя уверенно определить, что это нужный инструмент, приложение откажется её удалять.',
      },
      {
        id: 'mise',
        question: 'Нужно ли сначала устанавливать mise?',
        answer: 'Нет. Когда это понадобится, Whichcraft загрузит закреплённую версию mise и проверит её хеш. Приложение использует собственную папку данных и конфигурацию, отдельно от вашего mise. Инструменты устанавливаются в выбранную вами папку, и PATH не меняется, пока вы не выберете установку.',
      },
      {
        id: 'admin',
        question: 'Можно ли пользоваться Whichcraft без прав администратора?',
        answer: 'Да. Обычно переключение записывает данные только в пользовательское окружение. Если мешает системная запись или вы меняете системные переменные, Whichcraft показывает различия, предупреждает, что это затронет всех пользователей компьютера, и запрашивает подтверждение UAC.',
      },
      {
        id: 'terminal',
        question: 'Почему в открытом терминале всё ещё работает старая версия?',
        answer: 'Запущенный процесс сохраняет окружение, с которым он стартовал. Кнопка «Открыть терминал» в Whichcraft запускает оболочку с заново собранным окружением. Также можно перезапустить терминал и приложение, из которого он открыт, например редактор. Если оболочка всё ещё запускает другую версию, «Проверить в оболочке» покажет, меняет ли её профиль PATH.',
      },
      {
        id: 'cli',
        question: 'Можно ли использовать Whichcraft из командной строки или скриптов?',
        answer: 'Для переменных окружения — да. Команды get, list и export читают их, а set, delete и import изменяют. По умолчанию команды изменения работают в пробном режиме и записывают в реестр только с флагом --apply. Переключение и установка инструментов выполняются в приложении. Команда whichcraft --help показывает доступные команды и параметры.',
      },
      {
        id: 'uninstall',
        question: 'Что останется на компьютере после удаления Whichcraft?',
        answer: 'Приложение, ярлыки и запись в PATH удаляются. Инструменты, установленные через Whichcraft, остаются, так как их может использовать PATH или проект; если они больше не нужны, сначала удалите их в приложении. В установщике .exe отметьте удаление данных приложения, чтобы также удалить настройки, профили, снимки и историю отмены. В MSI такого параметра нет, и эти данные сохраняются.',
      },
    ],
    cliSetup: 'Запускайте команды из терминала. Добавьте Whichcraft в PATH через приложение или укажите полный путь к bin\\whichcraft.exe в папке установки.',
    cliDocs: 'Использование CLI и примеры',
  },
  lang: 'ru',
  title: 'Whichcraft — менеджер инструментов разработки для Windows',
  description: 'Находите, устанавливайте, переключайте и удаляйте версии Java, Node.js, Python, Go, Flutter и Git в Windows и проверяйте каждое изменение окружения перед применением. Бесплатно, с открытым исходным кодом, для Windows 10/11.',
  ogDescription: 'Находите, устанавливайте, переключайте и удаляйте версии Java, Node.js, Python, Go, Flutter и Git в Windows и проверяйте каждое изменение окружения перед применением. Бесплатно, с открытым исходным кодом, для Windows 10/11.',
  canonicalPath: '/Whichcraft/ru/',
  nav: {
    features: 'Возможности',
    storybook: 'Storybook',
    reports: 'Отчёты',
    download: 'Скачать',
  },
  hero: {
    eyebrow: `Менеджер инструментов разработки для Windows · v${VERSION}`,
    lead: 'Все версии инструментов разработки в одном месте, и вы решаете, какую запускает Windows. Проверяйте точные изменения PATH перед применением и отменяйте их, если передумаете.',
    download: `Скачать v${VERSION} для Windows`,
    github: 'Смотреть на GitHub →',
  },
  screenshots: {
    toolsAlt: 'Whichcraft — обзор инструментов разработки с действующими версиями Java, Node.js, Python, Go, Flutter и Git',
    planAlt: 'Whichcraft — диалог плана применения с изменением JAVA_HOME до записи',
    profilesAlt: 'Whichcraft — профили инструментов и соответствие сохранённых наборов текущему состоянию',
    firstLabel: 'Скриншот 1',
    secondLabel: 'Скриншот 2',
    thirdLabel: 'Скриншот 3',
    prevLabel: 'Предыдущий скриншот',
    nextLabel: 'Следующий скриншот',
  },
  featuresHeading: 'Возможности',
  featuresLead: 'Всё, чтобы каждый инструмент запускался в нужной версии.',
  features: [
    {
      icon: '⌕',
      title: 'Поиск установленного',
      desc: 'Просматривает PATH, реестр, стандартные расположения и добавленные вами папки. Для каждой установки показаны поставщик, версия, расположение и источник установки.',
    },
    {
      icon: '⇄',
      title: 'Переключение по плану',
      desc: 'Выберите установку и сначала посмотрите точные изменения JAVA_HOME и PATH. Пути записываются напрямую, без шимов, и ничего не меняется до нажатия Apply.',
    },
    {
      icon: '↓',
      title: 'Установка и обновление',
      desc: 'Устанавливайте Temurin, Node.js, Python, Go и Flutter из приложения. Обновление ставится рядом со старой версией, переключается на новую и предлагает удалить старую.',
    },
    {
      icon: '☰',
      title: 'Профили инструментов',
      desc: 'Сохраняйте именованные наборы, например Java 17 и Node 20, и применяйте их за один шаг. Инструменты вне профиля сохраняют текущую версию.',
    },
  ],
  otherFeaturesHeading: 'Также включено',
  otherFeatures: [
    {
      icon: '◎',
      title: 'Что запускается на самом деле',
      desc: 'Показывает установку, которую новый процесс действительно получает из реестра, и сообщает, если она отличается от выбранной.',
    },
    {
      icon: '>_',
      title: 'Проверка в оболочке',
      desc: 'Запускает выбранную оболочку с профилем и сообщает, если профиль или псевдоним направляет команду в другое место.',
    },
    {
      icon: '↩',
      title: 'Отмена и восстановление',
      desc: 'Отмена возвращает только изменения Whichcraft и сообщает о конфликтах. Если применение прервалось, при следующем запуске видно, что записано, и можно завершить его или откатить.',
    },
    {
      icon: '✕',
      title: 'Аккуратное удаление',
      desc: 'Показывает программы, которые ещё используют установку, спрашивает, на что переключиться, и предлагает обновить ссылающиеся на неё профили.',
    },
    {
      icon: '⠿',
      title: 'Очистка PATH',
      desc: 'Находит дублирующиеся и несуществующие записи в пользовательском PATH. Удаление проходит через тот же проверяемый план и отмену, что и другие изменения.',
    },
    {
      icon: '▶',
      title: 'Новый терминал',
      desc: 'Открывает Windows Terminal, PowerShell или командную строку с окружением, заново собранным из реестра, поэтому запускается именно выбранная версия.',
    },
    {
      icon: '▤',
      title: 'Обзор SDK',
      desc: 'Показывает компоненты Android SDK и NDK, наборы инструментов MSVC и Windows SDK в одном месте. Управление ими остаётся в Android Studio и Visual Studio.',
    },
    {
      icon: '≡',
      title: 'Работа с окружением',
      desc: 'Редактируйте пользовательские и системные переменные с показом различий, обнаружением секретов, зашифрованными снимками, импортом и экспортом и поиском команд.',
    },
  ],
  audience: {
    heading: 'Для кого это?',
    paragraphs: [
      'Whichcraft создан для разработчиков на Windows 10 и 11, которые держат рядом несколько версий инструментов и хотят ясно видеть, что есть на компьютере, без шимов и ручной правки переменных окружения.',
      'Переходите ли вы между Java 17 и 21 для разных сервисов, выясняете, почему терминал запускает не тот Node.js, или убираете старые SDK — Whichcraft показывает, что изменится, ещё до изменения.',
    ],
  },
  stack: {
    label: 'Built with',
    items: ['Tauri v2', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Rust'],
  },
  privacyNote: 'Телеметрии нет. Приложение выходит в сеть только для проверки новых версий на GitHub и загрузки выбранных вами инструментов вместе с закреплённой версией mise, которая их устанавливает.',
  footer: {
    copyright: '© 2026 Whichcraft · MIT License',
    releases: 'Релизы',
    license: 'Лицензия',
  },
};

export const koCopy: LandingCopy = {
  faq: {
    heading: '자주 묻는 질문',
    items: [
      {
        id: 'tools',
        question: 'Whichcraft는 어떤 개발 도구를 관리하나요?',
        answer: 'Java, Node.js, Python, Go, Flutter, Git의 설치 간에 전환할 수 있습니다. Java(Temurin), Node.js, Python, Go, Flutter는 설치, 업데이트, 제거도 지원하며 Git은 전환만 가능합니다. Android SDK와 NDK, MSVC, Windows SDK는 참고용으로만 표시되며 앱에서 변경할 수 없습니다.',
      },
      {
        id: 'switching',
        question: '전환은 어떻게 동작하나요? shim이나 프로젝트별 버전을 사용하나요?',
        answer: 'Whichcraft는 선택한 설치의 경로를 shim 없이 Windows 환경에 직접 기록합니다. 선택은 프로젝트가 아니라 컴퓨터 전체에 적용되므로 모든 새 프로세스가 같은 버전을 사용합니다. 프로젝트별 버전은 지원 범위가 아닙니다.',
      },
      {
        id: 'existing',
        question: '이미 설치한 도구에 영향을 주나요?',
        answer: '찾아낸 설치는 원래 위치에 그대로 있고 파일도 원래 설치 프로그램이 계속 관리합니다. 제거할 때는 등록된 제거 프로그램을 열거나, 확인을 거쳐 일반 폴더를 휴지통으로 옮깁니다. 폴더가 사용 중이거나 해당 도구임을 확신할 수 없으면 제거하지 않습니다.',
      },
      {
        id: 'mise',
        question: 'mise를 먼저 설치해야 하나요?',
        answer: '아니요. 필요할 때 Whichcraft가 고정된 버전의 mise를 내려받아 해시를 확인합니다. 데이터 폴더와 설정은 사용 중인 mise와 분리됩니다. 도구는 선택한 설치 폴더에 들어가며, 직접 선택하기 전까지 PATH는 바뀌지 않습니다.',
      },
      {
        id: 'admin',
        question: '관리자 권한 없이도 사용할 수 있나요?',
        answer: '네. 일반적인 전환은 사용자 환경에만 기록합니다. 시스템 항목이 앞서거나 시스템 변수를 변경하는 경우, Whichcraft는 차이를 보여 주고 PC의 모든 사용자에게 영향을 준다고 경고한 뒤 UAC 승인을 요청합니다.',
      },
      {
        id: 'terminal',
        question: '열려 있는 터미널에서 왜 아직 이전 버전이 실행되나요?',
        answer: '실행 중인 프로세스는 시작할 때의 환경을 유지합니다. Whichcraft의 터미널 열기를 사용하면 환경을 새로 구성한 셸이 열립니다. 또는 터미널과 이를 실행한 편집기 같은 앱을 다시 시작하세요. 그래도 다른 버전이 실행되면 셸에서 확인으로 프로필이 PATH를 바꾸는지 볼 수 있습니다.',
      },
      {
        id: 'cli',
        question: '명령줄이나 스크립트에서 Whichcraft를 사용할 수 있나요?',
        answer: '환경 변수에 대해서는 가능합니다. get, list, export는 읽기에, set, delete, import는 변경에 사용합니다. 변경 명령은 기본적으로 미리 실행만 하며 --apply를 추가할 때만 레지스트리에 기록합니다. 도구 전환과 설치는 앱에서 합니다. whichcraft --help로 명령과 옵션을 확인할 수 있습니다.',
      },
      {
        id: 'uninstall',
        question: 'Whichcraft를 제거하면 PC에 무엇이 남나요?',
        answer: '앱, 바로 가기, PATH 항목은 제거됩니다. Whichcraft로 설치한 도구는 PATH나 프로젝트에서 계속 쓸 수 있으므로 남습니다. 더 이상 필요 없다면 먼저 앱에서 제거하세요. .exe 설치 프로그램에서 앱 데이터 삭제 옵션을 선택하면 설정, 프로필, 스냅샷, 실행 취소 기록도 함께 제거됩니다. MSI에는 이 옵션이 없어 이 데이터가 유지됩니다.',
      },
    ],
    cliSetup: '터미널에서 실행하세요. 앱에서 Whichcraft를 PATH에 추가하거나 설치 폴더에 있는 bin\\whichcraft.exe의 전체 경로를 지정하세요.',
    cliDocs: 'CLI 사용법과 예제',
  },
  lang: 'ko',
  title: 'Whichcraft — Windows용 개발 도구 관리자',
  description: 'Windows에서 Java, Node.js, Python, Go, Flutter, Git의 버전을 찾고, 설치하고, 전환하고, 제거하세요. 모든 환경 변경은 적용 전에 확인할 수 있습니다. Windows 10/11용 무료 오픈소스 앱입니다.',
  ogDescription: 'Windows에서 Java, Node.js, Python, Go, Flutter, Git의 버전을 찾고, 설치하고, 전환하고, 제거하세요. 모든 환경 변경은 적용 전에 확인할 수 있습니다. Windows 10/11용 무료 오픈소스 앱입니다.',
  canonicalPath: '/Whichcraft/ko/',
  nav: {
    features: '기능',
    storybook: 'Storybook',
    reports: '리포트',
    download: '다운로드',
  },
  hero: {
    eyebrow: `Windows용 개발 도구 관리자 · v${VERSION}`,
    lead: '개발 도구의 모든 버전을 한곳에서 보고 Windows가 어떤 버전을 실행할지 정하세요. 적용 전에 PATH 변경 내용을 정확히 확인하고, 마음이 바뀌면 되돌릴 수 있습니다.',
    download: `Windows용 v${VERSION} 다운로드`,
    github: 'GitHub에서 보기 →',
  },
  screenshots: {
    toolsAlt: 'Whichcraft — Java, Node.js, Python, Go, Flutter, Git의 유효 버전을 보여 주는 개발 도구 개요',
    planAlt: 'Whichcraft — 기록 전 JAVA_HOME 변경을 보여 주는 적용 계획 대화 상자',
    profilesAlt: 'Whichcraft — 저장한 조합이 현재 적용된 상태와 일치하는지 보여 주는 도구 프로필',
    firstLabel: '스크린샷 1',
    secondLabel: '스크린샷 2',
    thirdLabel: '스크린샷 3',
    prevLabel: '이전 스크린샷',
    nextLabel: '다음 스크린샷',
  },
  featuresHeading: '기능',
  featuresLead: '도구마다 알맞은 버전을 실행하는 데 필요한 모든 것.',
  features: [
    {
      icon: '⌕',
      title: '설치된 도구 찾기',
      desc: 'PATH, 레지스트리, 표준 위치, 직접 추가한 폴더를 검색합니다. 설치마다 공급업체, 버전, 위치, 설치 주체를 보여 줍니다.',
    },
    {
      icon: '⇄',
      title: '계획을 확인하고 전환',
      desc: '설치를 고르면 JAVA_HOME과 PATH 변경 내용을 먼저 볼 수 있습니다. 경로는 shim 없이 직접 기록되며 Apply를 누르기 전에는 아무것도 바뀌지 않습니다.',
    },
    {
      icon: '↓',
      title: '설치와 업데이트',
      desc: 'Temurin, Node.js, Python, Go, Flutter를 앱에서 설치합니다. 업데이트는 이전 버전 옆에 설치하고 전환한 뒤 이전 버전 제거를 제안합니다.',
    },
    {
      icon: '☰',
      title: '도구 프로필',
      desc: 'Java 17과 Node 20 같은 조합을 이름을 붙여 저장하고 한 번에 적용합니다. 프로필에 없는 도구는 현재 버전을 유지합니다.',
    },
  ],
  otherFeaturesHeading: '이 외에도',
  otherFeatures: [
    {
      icon: '◎',
      title: '실제로 실행되는 버전',
      desc: '새 프로세스가 레지스트리에서 실제로 받는 설치를 보여 주고, 선택과 다르면 알려 줍니다.',
    },
    {
      icon: '>_',
      title: '셸에서 확인',
      desc: '설정한 셸을 프로필과 함께 실행하고, 프로필이나 별칭이 명령을 다른 곳으로 보내면 알려 줍니다.',
    },
    {
      icon: '↩',
      title: '되돌리기와 복구',
      desc: '되돌리기는 Whichcraft가 변경한 내용만 복원하고 충돌을 알려 줍니다. 적용이 중단되면 다음 실행 때 기록된 내용을 보여 주며 완료하거나 롤백할 수 있습니다.',
    },
    {
      icon: '✕',
      title: '신중한 제거',
      desc: '설치를 사용 중인 프로그램을 보여 주고, 먼저 전환할 대상을 묻고, 이를 가리키는 프로필의 업데이트를 제안합니다.',
    },
    {
      icon: '⠿',
      title: 'PATH 정리',
      desc: '사용자 PATH에서 중복되거나 존재하지 않는 항목을 찾습니다. 삭제도 다른 변경처럼 계획 검토와 되돌리기를 거칩니다.',
    },
    {
      icon: '▶',
      title: '새 터미널 열기',
      desc: '레지스트리에서 다시 구성한 환경으로 Windows Terminal, PowerShell, 명령 프롬프트를 열어 방금 선택한 버전이 실행됩니다.',
    },
    {
      icon: '▤',
      title: 'SDK 목록',
      desc: 'Android SDK와 NDK 구성 요소, MSVC 도구 집합, Windows SDK를 한곳에 보여 줍니다. 관리는 계속 Android Studio와 Visual Studio에서 합니다.',
    },
    {
      icon: '≡',
      title: '환경 작업 공간',
      desc: '차이 비교, 민감 정보 감지, 암호화된 스냅샷, 가져오기와 내보내기, 명령 조회와 함께 사용자 및 시스템 변수를 편집합니다.',
    },
  ],
  audience: {
    heading: '누구를 위한 도구인가요?',
    paragraphs: [
      'Whichcraft는 Windows 10과 11에서 도구의 여러 버전을 함께 쓰는 개발자를 위한 앱입니다. shim이나 환경 변수 수동 편집 없이 컴퓨터에 무엇이 있는지 분명하게 볼 수 있습니다.',
      '서비스에 따라 Java 17과 21을 오가거나, 터미널이 왜 다른 Node.js를 실행하는지 찾거나, 오래된 SDK를 정리할 때 Whichcraft는 바뀌기 전에 무엇이 바뀔지 보여 줍니다.',
    ],
  },
  stack: {
    label: 'Built with',
    items: ['Tauri v2', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Rust'],
  },
  privacyNote: '텔레메트리는 없습니다. 앱은 GitHub에서 새 버전을 확인하고, 선택한 도구와 이를 설치하는 데 쓰는 고정 버전의 mise를 받을 때만 온라인에 연결합니다.',
  footer: {
    copyright: '© 2026 Whichcraft · MIT License',
    releases: '릴리스',
    license: '라이선스',
  },
};

export const viCopy: LandingCopy = {
  faq: {
    heading: 'Câu hỏi thường gặp',
    items: [
      {
        id: 'tools',
        question: 'Whichcraft quản lý những công cụ phát triển nào?',
        answer: 'Bạn có thể chuyển giữa các bản cài đặt của Java, Node.js, Python, Go, Flutter và Git. Java (Temurin), Node.js, Python, Go và Flutter còn có thể cài đặt, cập nhật và gỡ bỏ; Git chỉ có thể chuyển đổi. Android SDK và NDK, MSVC và Windows SDK chỉ hiển thị để tham khảo và không thể thay đổi từ ứng dụng.',
      },
      {
        id: 'switching',
        question: 'Việc chuyển đổi hoạt động thế nào? Có dùng shim hay phiên bản theo dự án không?',
        answer: 'Whichcraft ghi trực tiếp đường dẫn của bản cài đặt bạn chọn vào môi trường Windows, không dùng shim. Lựa chọn áp dụng cho toàn bộ máy chứ không cho từng dự án, nên mọi tiến trình mới đều dùng cùng một phiên bản. Phiên bản theo dự án nằm ngoài phạm vi hỗ trợ.',
      },
      {
        id: 'existing',
        question: 'Ứng dụng có đụng đến các công cụ tôi đã cài không?',
        answer: 'Các bản cài đặt tìm thấy vẫn ở nguyên vị trí và tệp vẫn thuộc trình cài đặt gốc. Khi gỡ bỏ, Whichcraft mở trình gỡ cài đặt đã đăng ký, hoặc chuyển thư mục thường vào Thùng rác sau khi bạn xác nhận. Ứng dụng sẽ từ chối nếu thư mục đang được dùng hoặc không chắc đó là công cụ tương ứng.',
      },
      {
        id: 'mise',
        question: 'Tôi có cần cài mise trước không?',
        answer: 'Không. Khi cần, Whichcraft tải xuống phiên bản mise đã ghim và kiểm tra mã băm. Ứng dụng dùng thư mục dữ liệu và cấu hình riêng, tách biệt với mise bạn đang dùng. Công cụ được cài vào thư mục bạn chọn, và PATH không đổi cho đến khi bạn chọn một bản cài đặt.',
      },
      {
        id: 'admin',
        question: 'Tôi có thể dùng Whichcraft mà không có quyền quản trị không?',
        answer: 'Có. Việc chuyển đổi thường chỉ ghi vào môi trường Người dùng. Khi một mục Hệ thống cản trở hoặc bạn thay đổi biến Hệ thống, Whichcraft hiển thị khác biệt, cảnh báo rằng thay đổi ảnh hưởng đến mọi người dùng trên máy và yêu cầu phê duyệt UAC.',
      },
      {
        id: 'terminal',
        question: 'Tại sao terminal đang mở vẫn chạy phiên bản cũ?',
        answer: 'Tiến trình đang chạy giữ môi trường lúc nó khởi động. Dùng nút Mở terminal trong Whichcraft để có shell với môi trường mới, hoặc khởi động lại terminal và ứng dụng đã mở nó, chẳng hạn trình soạn thảo. Nếu shell vẫn chạy phiên bản khác, Kiểm tra trong shell sẽ cho biết profile có đổi PATH hay không.',
      },
      {
        id: 'cli',
        question: 'Tôi có thể dùng Whichcraft từ dòng lệnh hoặc script không?',
        answer: 'Có, đối với biến môi trường. get, list và export dùng để đọc; set, delete và import dùng để thay đổi. Các lệnh thay đổi mặc định chỉ chạy thử và chỉ ghi vào registry khi thêm --apply. Việc chuyển đổi và cài đặt công cụ được thực hiện trong ứng dụng. Chạy whichcraft --help để xem các lệnh và tùy chọn.',
      },
      {
        id: 'uninstall',
        question: 'Sau khi gỡ Whichcraft, những gì còn lại trên máy?',
        answer: 'Ứng dụng, lối tắt và mục PATH sẽ bị xóa. Các công cụ đã cài qua Whichcraft vẫn được giữ vì PATH hoặc dự án có thể vẫn dùng; nếu không cần nữa, hãy gỡ chúng trong ứng dụng trước. Với trình cài đặt .exe, chọn tùy chọn xóa dữ liệu ứng dụng để xóa cả cài đặt, hồ sơ, bản chụp nhanh và lịch sử hoàn tác. MSI không có tùy chọn này nên dữ liệu vẫn được giữ.',
      },
    ],
    cliSetup: 'Chạy từ terminal. Thêm Whichcraft vào PATH bằng ứng dụng, hoặc dùng đường dẫn đầy đủ tới bin\\whichcraft.exe trong thư mục cài đặt.',
    cliDocs: 'Cách dùng CLI và ví dụ',
  },
  lang: 'vi',
  title: 'Whichcraft — Trình quản lý công cụ phát triển cho Windows',
  description: 'Tìm, cài đặt, chuyển đổi và gỡ bỏ các phiên bản Java, Node.js, Python, Go, Flutter và Git trên Windows, đồng thời xem lại mọi thay đổi môi trường trước khi áp dụng. Miễn phí, mã nguồn mở, dành cho Windows 10/11.',
  ogDescription: 'Tìm, cài đặt, chuyển đổi và gỡ bỏ các phiên bản Java, Node.js, Python, Go, Flutter và Git trên Windows, đồng thời xem lại mọi thay đổi môi trường trước khi áp dụng. Miễn phí, mã nguồn mở, dành cho Windows 10/11.',
  canonicalPath: '/Whichcraft/vi/',
  nav: {
    features: 'Tính năng',
    storybook: 'Storybook',
    reports: 'Báo cáo',
    download: 'Tải xuống',
  },
  hero: {
    eyebrow: `Trình quản lý công cụ phát triển cho Windows · v${VERSION}`,
    lead: 'Xem mọi phiên bản công cụ phát triển ở một nơi và quyết định Windows chạy phiên bản nào. Xem chính xác các thay đổi PATH trước khi áp dụng và hoàn tác nếu bạn đổi ý.',
    download: `Tải xuống v${VERSION} cho Windows`,
    github: 'Xem trên GitHub →',
  },
  screenshots: {
    toolsAlt: 'Whichcraft — tổng quan công cụ phát triển với phiên bản có hiệu lực của Java, Node.js, Python, Go, Flutter và Git',
    planAlt: 'Whichcraft — hộp thoại kế hoạch áp dụng hiển thị thay đổi JAVA_HOME trước khi ghi',
    profilesAlt: 'Whichcraft — hồ sơ công cụ cho biết bộ đã lưu nào khớp với trạng thái đang có hiệu lực',
    firstLabel: 'Ảnh chụp màn hình 1',
    secondLabel: 'Ảnh chụp màn hình 2',
    thirdLabel: 'Ảnh chụp màn hình 3',
    prevLabel: 'Ảnh chụp màn hình trước',
    nextLabel: 'Ảnh chụp màn hình tiếp theo',
  },
  featuresHeading: 'Tính năng',
  featuresLead: 'Mọi thứ bạn cần để mỗi công cụ chạy đúng phiên bản.',
  features: [
    {
      icon: '⌕',
      title: 'Tìm những gì đã cài',
      desc: 'Tìm trong PATH, registry, các vị trí tiêu chuẩn và thư mục bạn thêm vào. Mỗi bản cài đặt hiển thị nhà cung cấp, phiên bản, vị trí và nguồn cài đặt.',
    },
    {
      icon: '⇄',
      title: 'Chuyển đổi theo kế hoạch',
      desc: 'Chọn một bản cài đặt và xem trước chính xác thay đổi JAVA_HOME và PATH. Đường dẫn được ghi trực tiếp, không dùng shim, và không có gì thay đổi cho đến khi bạn nhấn Apply.',
    },
    {
      icon: '↓',
      title: 'Cài đặt và cập nhật',
      desc: 'Cài Temurin, Node.js, Python, Go và Flutter ngay trong ứng dụng. Bản cập nhật được cài cạnh phiên bản cũ, chuyển sang bản mới rồi đề xuất gỡ bản cũ.',
    },
    {
      icon: '☰',
      title: 'Hồ sơ công cụ',
      desc: 'Lưu các bộ có tên như Java 17 với Node 20 rồi áp dụng trong một bước. Công cụ không có trong hồ sơ giữ nguyên phiên bản hiện tại.',
    },
  ],
  otherFeaturesHeading: 'Còn có thêm',
  otherFeatures: [
    {
      icon: '◎',
      title: 'Phiên bản thực sự chạy',
      desc: 'Hiển thị bản cài đặt mà tiến trình mới thực sự nhận từ registry và báo cho bạn khi nó khác với lựa chọn của bạn.',
    },
    {
      icon: '>_',
      title: 'Kiểm tra trong shell',
      desc: 'Chạy shell bạn đã cấu hình với profile và báo khi profile hoặc alias đưa lệnh đến nơi khác.',
    },
    {
      icon: '↩',
      title: 'Hoàn tác và khôi phục',
      desc: 'Hoàn tác chỉ khôi phục những gì Whichcraft đã đổi và báo xung đột. Nếu việc áp dụng bị gián đoạn, lần mở sau sẽ cho biết phần đã ghi để bạn hoàn tất hoặc khôi phục.',
    },
    {
      icon: '✕',
      title: 'Gỡ bỏ cẩn thận',
      desc: 'Liệt kê các chương trình còn dùng bản cài đặt, hỏi cần chuyển sang đâu trước và đề xuất cập nhật các hồ sơ đang trỏ đến nó.',
    },
    {
      icon: '⠿',
      title: 'Dọn dẹp PATH',
      desc: 'Tìm các mục trùng lặp và không tồn tại trong PATH Người dùng. Việc xóa cũng đi qua kế hoạch xem lại và hoàn tác như mọi thay đổi khác.',
    },
    {
      icon: '▶',
      title: 'Mở terminal mới',
      desc: 'Mở Windows Terminal, PowerShell hoặc Command Prompt với môi trường dựng lại từ registry, nên chạy đúng phiên bản bạn vừa chọn.',
    },
    {
      icon: '▤',
      title: 'Danh mục SDK',
      desc: 'Hiển thị các thành phần Android SDK và NDK, bộ công cụ MSVC và Windows SDK ở một nơi. Bạn vẫn quản lý chúng bằng Android Studio và Visual Studio.',
    },
    {
      icon: '≡',
      title: 'Không gian môi trường',
      desc: 'Chỉnh sửa biến Người dùng và Hệ thống với so sánh khác biệt, phát hiện thông tin bí mật, ảnh chụp nhanh mã hóa, nhập và xuất, cùng tra cứu lệnh.',
    },
  ],
  audience: {
    heading: 'Dành cho ai?',
    paragraphs: [
      'Whichcraft dành cho các nhà phát triển trên Windows 10 và 11 dùng song song nhiều phiên bản công cụ và muốn thấy rõ trên máy có gì, không cần shim hay tự sửa biến môi trường.',
      'Dù bạn đang chuyển giữa Java 17 và 21 cho các dịch vụ khác nhau, tìm hiểu vì sao terminal chạy sai Node.js hay dọn các SDK cũ, Whichcraft cho bạn thấy điều gì sẽ thay đổi trước khi nó xảy ra.',
    ],
  },
  stack: {
    label: 'Built with',
    items: ['Tauri v2', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Rust'],
  },
  privacyNote: 'Không có telemetry. Ứng dụng chỉ kết nối mạng để kiểm tra phiên bản mới trên GitHub và tải các công cụ bạn chọn cài, cùng phiên bản mise đã ghim dùng để cài chúng.',
  footer: {
    copyright: '© 2026 Whichcraft · MIT License',
    releases: 'Bản phát hành',
    license: 'Giấy phép',
  },
};
