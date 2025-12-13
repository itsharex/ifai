use tauri::{command, async_runtime, AppHandle, Manager, Emitter};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;

// Store PTY sessions
type PtySessions = Arc<Mutex<HashMap<u32, Box<dyn portable_pty::PtyPair + Send>>>>;

pub struct TerminalManager {
    pty_sessions: PtySessions,
    pty_system: NativePtySystem,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            pty_sessions: Arc::new(Mutex::new(HashMap::new())),
            pty_system: NativePtySystem::new().unwrap(),
        }
    }
}

// Global PTY counter for unique IDs
static NEXT_PTY_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[command]
pub async fn create_pty(app_handle: AppHandle, manager: tauri::State<'_, TerminalManager>, cols: u16, rows: u16, cwd: Option<String>) -> Result<u32, String> {
    let pty_id = NEXT_PTY_ID.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let mut command = CommandBuilder::new();

    // Default shell
    #[cfg(target_os = "windows")]
    command.program("powershell.exe");
    #[cfg(not(target_os = "windows"))]
    command.program("bash"); 

    if let Some(dir) = cwd {
        command.cwd(PathBuf::from(dir));
    } else {
        command.cwd(app_handle.path_resolver().app_dir().unwrap_or_default());
    }

    let pty_pair = manager.pty_system.openpty(PtySize { cols, rows, pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;
    let mut child = pty_pair.slave.spawn_command(command).map_err(|e| e.to_string())?; // Added 'mut'

    let mut reader = pty_pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let event_name = format!("pty-output-{}", pty_id);

    // Spawn a thread to read PTY output and emit to frontend
    async_runtime::spawn(async move {
        let mut buf = [0; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // EOF, child process exited
                    let _ = app_handle.emit(&format!("pty-exit-{}", pty_id), pty_id);
                    break;
                },
                Ok(bytes_read) => {
                    let output = String::from_utf8_lossy(&buf[..bytes_read]);
                    let _ = app_handle.emit(&event_name, output.to_string());
                },
                Err(e) => {
                    // Error reading from PTY, child process might have exited
                    eprintln!("Error reading from PTY: {}", e);
                    let _ = app_handle.emit(&format!("pty-error-{}", pty_id), e.to_string());
                    break;
                },
            }
        }
        let _ = child.wait(); // Wait for child to ensure resources are cleaned
    });

    manager.pty_sessions.lock().unwrap().insert(pty_id, pty_pair.master);

    Ok(pty_id)
}

#[command]
pub async fn write_pty(manager: tauri::State<'_, TerminalManager>, pty_id: u32, data: String) -> Result<(), String> {
    let mut sessions = manager.pty_sessions.lock().unwrap();
    if let Some(master) = sessions.get_mut(&pty_id) {
        master.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("PTY session {} not found", pty_id))
    }
}

#[command]
pub async fn resize_pty(manager: tauri::State<'_, TerminalManager>, pty_id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let mut sessions = manager.pty_sessions.lock().unwrap();
    if let Some(master) = sessions.get_mut(&pty_id) {
        master.resize(PtySize { cols, rows, pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("PTY session {} not found", pty_id))
    }
}

#[command]
pub async fn kill_pty(manager: tauri::State<'_, TerminalManager>, pty_id: u32) -> Result<(), String> {
    let mut sessions = manager.pty_sessions.lock().unwrap();
    if let Some(master) = sessions.remove(&pty_id) {
        // Drop the master, which should signal the child to exit
        drop(master);
        Ok(())
    } else {
        Err(format!("PTY session {} not found", pty_id))
    }
}
