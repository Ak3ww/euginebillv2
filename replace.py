import re

filepath = r"C:\EugineBill\src\app\customer\tickets\[id]\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace cyberpunk imports
content = re.sub(r"import\s+\{.*\}\s+from\s+['\"]@/components/cyberpunk.*?['\"];?\n?", "", content)

# Basic replacements
replacements = {
    r'\bbg-paper\b': 'bg-[var(--color-paper)]',
    r'\bborder-rule\b': 'border-[var(--color-rule)]',
    r'\btext-ink\b': 'text-[var(--color-ink)]',
    r'\btext-muted\b': 'text-[var(--color-muted)]',
    r'\bbg-accent\b': 'bg-[var(--color-accent)]',
    r'\btext-accent\b': 'text-[var(--color-focus)]',
    r'\bbg-background\b': 'bg-[var(--color-paper)]',
    r'\bborder-accent/20\b': 'border-[var(--color-focus)]/20', # or rule?
    r'\border-cyan(-\d+)?\b': 'border-[var(--color-focus)]',
    r'\bbg-slate(-\d+)?\b': 'bg-[var(--color-paper-2)]',
    r'\bhover:text-\[var\(--color-accent\)\]-hover\b': 'hover:text-[var(--color-focus)]',
    r'\bhover:bg-\[var\(--color-accent\)\]-hover\b': 'hover:opacity-90',
}

for pattern, repl in replacements.items():
    content = re.sub(pattern, repl, content)

# Remove dark: classes
content = re.sub(r'\bdark:[^\s"\']+', '', content)

# Ensure extra spaces from removed dark classes are cleaned up (optional but nice)
content = re.sub(r'  +', ' ', content)

# Replace useToast if it was from cyberpunk
content = re.sub(r'const\s+\{\s*addToast\s*\}\s*=\s*useToast\(\);\s*\n?', '', content)
content = re.sub(r'const\s+toast\s*=\s*.*?;\s*\n', '', content)
content = re.sub(r'toast\(', 'console.log(', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Page 2 replacements done.")
