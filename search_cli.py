import json
import os
import mariadb
import argparse
from engine.cortex.database import get_connection
from engine.cortex.processor import vectorize

CONFIG_FILE = "config.json"

def search(query_text, tag_filter=None, limit=5):
    if not os.path.exists(CONFIG_FILE):
        print("❌ System not configured. Please run 'python engine/main.py' first.")
        return
    
    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)
    
    try:
        conn = get_connection(config)
        cur = conn.cursor()
        
        # 1. Vectorize query
        print(f"🔍 Searching for: '{query_text}'" + (f" (Filtered by tag: #{tag_filter})" if tag_filter else ""))
        query_vector = vectorize(query_text)
        
        # 2. Hybrid SQL + Vector Search
        # Match exact tag using boundary markers for comma-separated string
        sql = """
            SELECT n.file_name, nc.content, VEC_DISTANCE(nc.embedding, VEC_FromText(?)) as distance
            FROM note_chunks nc
            JOIN notes n ON nc.note_id = n.id
            WHERE (? = "None" OR CONCAT(',', n.tags, ',') LIKE ?)
            ORDER BY distance ASC
            LIMIT ?
        """
        
        # Pattern to match tag within comma-separated list
        # E.g. Find #ideas in "#research,#ideas,#todo"
        tag_param = str(tag_filter)
        tag_like = f"%,{tag_filter},%" if tag_filter else "%"
        
        cur.execute(sql, (str(query_vector), tag_param, tag_like, limit))
        
        results = cur.fetchall()
        
        if not results:
            print("📭 No results found.")
        else:
            print(f"\n--- Top {len(results)} Results ---")
            for (file_name, content, distance) in results:
                print(f"\n📄 [{file_name}] (Relevance Score: {distance:.4f})")
                # Clean up display white space
                display_content = " ".join(content.split())
                print(f"   {display_content[:200]}...")
        
        conn.close()
    except Exception as e:
        print(f"❌ Search error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Obsidian-MariaDB Hybrid Search Tool")
    parser.add_argument("query", help="The semantic search query")
    parser.add_argument("--tag", help="Filter results by an Obsidian tag")
    parser.add_argument("--limit", type=int, default=5, help="Number of results to return (default: 5)")
    
    args = parser.parse_args()
    search(args.query, args.tag, args.limit)
