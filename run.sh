#!/bin/bash
echo "=== Starting Comment Reader Test ==="

# Check if comments.txt exists
if [ ! -f "comments.txt" ]; then
    echo "Error: comments.txt not found!"
    exit 1
fi

# Read comments line by line
counter=1
while IFS= read -r comment; do
    # Skip empty lines
    if [ -n "$comment" ]; then
        echo "[$counter] Ready: $comment"
        # Pause briefly to simulate a sequence
        sleep 1
        counter=$((counter + 1))
    fi
done < comments.txt

echo "=== Finished reading all comments! ==="
