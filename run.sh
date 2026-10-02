#!/bin/bash
# My Danmei Library - Start script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ -f "$DIR/venv/bin/python" ]; then
    PYTHON="$DIR/venv/bin/python"
else
    PYTHON="python3"
fi

echo "=================================================="
echo "  Starting My Danmei Library                      "
echo "  Open in your browser: http://127.0.0.1:5000     "
echo "=================================================="
$PYTHON app.py
