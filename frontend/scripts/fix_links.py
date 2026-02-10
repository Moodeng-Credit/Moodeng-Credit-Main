import os
import re


def replace_link_href(directory):
    link_pattern = re.compile(r'<Link\s+([^>]*?)href=(["\'])(.*?)\2([^>]*?)>', re.DOTALL)

    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.jsx')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()

                new_content = link_pattern.sub(r'<Link \1to=\2\3\2\4>', content)

                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated {path}")

if __name__ == "__main__":
    import sys
    # Use current directory's src folder if no argument provided
    src_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'src')
    replace_link_href(src_dir)
