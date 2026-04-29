import os
import json
import time
import sys
from watchdog.observers import Observer

# --- Path Hardening ---
# Ensure the 'engine' directory is in the path for internal cortex imports
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(base_dir) # One level up from 'engine'

if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

try:
    from cortex.database import initialize_db, reset_db
    from cortex.watcher import ObsidianHandler
except ImportError as e:
    print(f"❌ Initialization Error: {e}")
    print(f"DEBUG: sys.path is {sys.path}")
    print(f"DEBUG: base_dir is {base_dir}")
    sys.exit(1)
# --------------------

CONFIG_FILE = os.path.join(project_root, "config.json")

def get_vault_path(prev_path=None):
    print("\n--- 📝 Neural Vault Session Setup ---")
    prompt = "Enter Obsidian Vault Path"
    if prev_path:
        prompt += f" (Press Enter for '{prev_path}')"
    
    vault = input(f"{prompt}: ").strip()
    
    if not vault and prev_path:
        vault = prev_path
        
    while not os.path.exists(vault) or not os.path.isdir(vault):
        vault = input("Path invalid or not a directory. Please enter a valid path: ").strip()
    
    return os.path.abspath(vault)

if __name__ == "__main__":
    # Load previous config if exists
    prev_config = {}
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                prev_config = json.load(f)
        except:
            pass

    # Always ask for vault path
    vault_path = get_vault_path(prev_config.get("vault_path"))
    
    # Session Configuration
    config = {
        "vault_path": vault_path,
        "db_host": prev_config.get("db_host", "localhost"),
        "db_user": prev_config.get("db_user", "root"),
        "db_name": prev_config.get("db_name", "obsidian_sync")
    }

    # Always prompt for password and verify connection
    print(f"\n🔑 Database Connection Required")
    while True:
        pw = input("Enter MariaDB root password: ").strip()
        config["db_password"] = pw
        
        try:
            # Prepare database
            initialize_db(config)
            
            # Ask for Refresh
            refresh = input("\n🔄 Perform fresh neural sync? (Wipe data & re-index) [y/N]: ").lower().strip()
            if refresh == 'y':
                reset_db(config)
            
            # Success! Save updated config
            with open(CONFIG_FILE, "w") as f:
                json.dump(config, f, indent=4)
            break
        except Exception as e:
            print(f"❌ Connection failed: {e}. Please try again.")

    handler = ObsidianHandler(config)
    
    # Initial Full Scan (Always scan to ensure everything is indexed)
    print(f"🔍 Syncing neural pathways for: {config['vault_path']}...")
    for root, _, files in os.walk(config['vault_path']):
        for file in files:
            if file.endswith(".md"):
                handler.process_file(os.path.join(root, file))
    print("✨ Initial scan complete.")

    # Start Real-Time Monitoring
    observer = Observer()
    observer.schedule(handler, config['vault_path'], recursive=True)
    observer.start()
    
    print(f"\n🚀 System Active!")
    print(f"📁 Watching: {config['vault_path']}")
    print(f"Press Ctrl+C to stop.\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n👋 Sync stopped.")
    observer.join()
