import json
import sys

from markitdown import MarkItDown


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: markitdown-convert.py <file>", file=sys.stderr)
        return 2

    try:
        result = MarkItDown().convert(sys.argv[1])
        sys.stdout.write(json.dumps({"markdown": result.text_content}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
