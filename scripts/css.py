"""Łączy domyślny arkusz wydruku z lokalnymi nadpisaniem."""
import os


def load_print_css(root):
    parts = []
    for name in ('print_default.css', 'print.css'):
        path = os.path.join(root, 'scripts', name)
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                parts.append(f.read())
    return '\n'.join(parts)
