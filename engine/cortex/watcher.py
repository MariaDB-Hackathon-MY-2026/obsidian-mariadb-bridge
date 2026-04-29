import os
import re
from watchdog.events import FileSystemEventHandler
from .database import get_connection
from .processor import get_chunks, vectorize

class ObsidianHandler(FileSystemEventHandler):
    def __init__(self, config):
        self.config = config

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith(".md"):
            self.process_file(event.src_path)

    def on_deleted(self, event):
        if not event.is_directory and event.src_path.endswith(".md"):
            self.remove_file(event.src_path)

    def on_moved(self, event):
        if not event.is_directory and event.dest_path.endswith(".md"):
            self.remove_file(event.src_path)
            self.process_file(event.dest_path)

    def remove_file(self, file_path):
        conn = get_connection(self.config)
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM notes WHERE file_path=?", (file_path,))
            conn.commit()
            print(f"🗑️ Removed stencil: {os.path.basename(file_path)}")
        except Exception as e:
            print(f"❌ Error removing {file_path}: {e}")
        finally:
            conn.close()

    def process_file(self, file_path):
        conn = get_connection(self.config)
        cur = conn.cursor()
        
        try:
            if not os.path.exists(file_path):
                return

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            file_name = os.path.basename(file_path)
            
            # Improved tag extraction:
            # 1. Inline tags: #tag, #tag/subtag
            tags_found = set()
            inline_tags = re.findall(r'#([\w/-]+)', content)
            for t in inline_tags:
                tags_found.add(f"#{t}")
            
            # 2. YAML extraction (more robust)
            if content.startswith('---'):
                yaml_end = content.find('---', 3)
                if yaml_end != -1:
                    yaml_part = content[3:yaml_end]
                    # Support both 'tags:' and 'tag:'
                    tag_line = re.search(r'^(?:tags|tag):\s*(.*)$', yaml_part, re.MULTILINE | re.IGNORECASE)
                    if tag_line:
                        val = tag_line.group(1).strip()
                        y_tags = []
                        # Handle [tag1, tag2]
                        if val.startswith('[') and val.endswith(']'):
                            y_tags = [t.strip() for t in val[1:-1].split(',')]
                        # Handle list style
                        elif not val:
                            # Search for bulleted list starting after tags:
                            list_match = re.findall(r'^\s*-\s+(.*)$', yaml_part[tag_line.end():], re.MULTILINE)
                            y_tags = list_match if list_match else []
                        # Handle comma separated string or single tag
                        else:
                            y_tags = [t.strip() for t in val.split(',')]
                            
                        for t in y_tags:
                            t = t.replace('"', '').replace("'", "")
                            if t:
                                # Standardize to #tag
                                if not t.startswith('#'):
                                    t = '#' + t
                                tags_found.add(t)

            tags_str = ",".join(sorted(list(tags_found)))

            cur.execute("""
                INSERT INTO notes (file_path, file_name, tags, last_modified)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE tags=VALUES(tags), last_modified=NOW()
            """, (file_path, file_name, tags_str))
            
            cur.execute("SELECT id FROM notes WHERE file_path=?", (file_path,))
            note_id = cur.fetchone()[0]
            
            # Clear old chunks for this note
            cur.execute("DELETE FROM note_chunks WHERE note_id=?", (note_id,))
            
            # Vectorize and insert new chunks
            for chunk in get_chunks(content):
                embedding = vectorize(chunk)
                cur.execute(
                    "INSERT INTO note_chunks (note_id, content, embedding) VALUES (?, ?, VEC_FromText(?))",
                    (note_id, chunk, str(embedding))
                )
            conn.commit()
            print(f"✅ Indexed: {file_name}")
        except Exception as e:
            print(f"❌ Error processing {file_path}: {e}")
        finally:
            conn.close()
