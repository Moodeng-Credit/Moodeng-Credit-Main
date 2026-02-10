import os
import re


def migrate_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Remove 'use client'
    content = content.replace("'use client';", "")
    content = content.replace('"use client";', "")

    # Replace next/link
    content = content.replace("import Link from 'next/link'", "import { Link } from 'react-router-dom'")
    content = content.replace('import Link from "next/link"', 'import { Link } from "react-router-dom"')

    # Replace next/image
    content = re.sub(r"import Image from 'next/image';?", "", content)
    content = re.sub(r'import Image from "next/image";?', "", content)
    content = content.replace("<Image", "<img")

    # Replace next/navigation
    if "next/navigation" in content or "next/dist/shared/lib/app-router-context" in content:
        content = content.replace("import { useRouter } from 'next/navigation'", "import { useNavigate } from 'react-router-dom'")
        content = content.replace('import { useRouter } from "next/navigation"', 'import { useNavigate } from "react-router-dom"')

        # Handle multiple imports from next/navigation
        content = re.sub(r"import \{ (.*) \} from 'next/navigation'", r"import { \1 } from 'react-router-dom'", content)
        content = re.sub(r'import \{ (.*) \} from "next/navigation"', r'import { \1 } from "react-router-dom"', content)

        content = content.replace("useRouter()", "useNavigate()")
        content = content.replace("router.push(", "navigate(")
        content = content.replace("router.replace(", "navigate(")

        content = content.replace("usePathname()", "useLocation().pathname")

        # Handle AppRouterInstance
        content = re.sub(r"import type \{ AppRouterInstance \} from 'next/.*'", "import type { NavigateFunction as AppRouterInstance } from 'react-router-dom'", content)

    # Remove next/headers
    content = re.sub(r"import \{ cookies \} from 'next/headers';?", "", content)

    # Replace process.env.NEXT_PUBLIC_ with import.meta.env.VITE_
    content = content.replace("process.env.NEXT_PUBLIC_", "import.meta.env.VITE_")

    # Replace process.env.NODE_ENV with import.meta.env.MODE
    content = content.replace("process.env.NODE_ENV", "import.meta.env.MODE")

    # Replace hardcoded /api/ calls with VITE_API_URL
    # Note: We assume VITE_API_URL is defined in .env
    content = content.replace("fetch('/api/", "fetch(import.meta.env.VITE_API_URL + '/")
    content = content.replace('fetch("/api/', 'fetch(import.meta.env.VITE_API_URL + "/')
    content = content.replace("axios.post('/api/", "axios.post(import.meta.env.VITE_API_URL + '/")
    content = content.replace('axios.post("/api/', 'axios.post(import.meta.env.VITE_API_URL + "/')

    with open(file_path, 'w') as f:
        f.write(content)

def walk_dir(dir_path):
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                migrate_file(os.path.join(root, file))

if __name__ == "__main__":
    walk_dir('/Users/anthonytjuatja/Dev/business/Moodeng-Credit-Main/vite-frontend/src')

