fn main() {
    #[cfg(windows)]
    {
        println!("cargo:rerun-if-changed=icons/icon.ico");
        println!("cargo:rerun-if-changed=icons/icon.png");
        // The GUI embeds frontend assets in generate_context!. Track the directory as
        // Vite replaces hashed filenames, so an incremental build cannot keep old assets.
        println!("cargo:rerun-if-changed=../dist");
        tauri_build::build()
    }
}
