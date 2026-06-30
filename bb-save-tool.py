import json
import gzip
import sys

def deep_unescape(s):
    prev = None
    cur = s
    while prev != cur:
        prev = cur
        try:
            cur = json.loads(cur)
        except Exception:
            break
    return cur

def unpack_save(input_path, output_path):
    """Natively decompresses a .gz save and unescapes the inner string layout."""
    print(f"Decompressing and reading file from: {input_path}...")
    
    try:
        # Natively open and read the gzip compressed layer
        with gzip.open(input_path, "rt", encoding="utf-8") as f:
            save_obj = json.load(f)
    except Exception:
        print("⚠️ File doesn't appear to be gzipped. Attempting to parse as raw JSON...")
        with open(input_path, "r", encoding="utf-8") as f:
            save_obj = json.load(f)
    
    unpacked_data = {}
    for key, value in save_obj["data"].items():
        if isinstance(value, str) and (value.startswith('{"') or value.startswith('[')):
            try:
                unpacked_data[key] = deep_unescape(value)
            except Exception:
                unpacked_data[key] = value
        else:
            unpacked_data[key] = value
            
    save_obj["data"] = unpacked_data
    
    # Write a beautifully formatted, fully unescaped JSON file for easy editing
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(save_obj, f, indent=2)
    print(f"🎉 Success! Human-readable scratchpad created at: {output_path}")

def pack_save(input_path, output_path):
    """Re-escapes JSON objects and natively recompiles them into an import-ready .gz file."""
    print(f"Reading edited file from: {input_path}...")
    with open(input_path, "r", encoding="utf-8") as f:
        save_obj = json.load(f)
        
    packed_data = {}
    for key, value in save_obj["data"].items():
        if isinstance(value, (dict, list)):
            packed_data[key] = json.dumps(value, separators=(',', ':'))
        else:
            packed_data[key] = value
            
    save_obj["data"] = packed_data
    
    # Compact stringify the main object structure
    compact_json = json.dumps(save_obj, separators=(',', ':'))
    
    # Natively compress into an import-ready .json.gz file closure
    with gzip.open(output_path, "wt", encoding="utf-8") as f:
        f.write(compact_json)
    print(f"🎉 Success! Compressed production save file compiled at: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ["unpack", "pack"]:
        print("Usage:")
        print("  python bb-save-tool.py unpack <input_file.json.gz> [output.json]")
        print("  python bb-save-tool.py pack   <input_file.json>    [output.json.gz]")
        sys.exit(1)
        
    action = sys.argv[1]
    infile = sys.argv[2]
    
    if action == "unpack":
        outfile = sys.argv[3] if len(sys.argv) > 3 else "readable_save.json"
        unpack_save(infile, outfile)
    elif action == "pack":
        outfile = sys.argv[3] if len(sys.argv) > 3 else "modified_save.json.gz"
        pack_save(infile, outfile)
