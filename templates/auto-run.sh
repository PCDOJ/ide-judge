#!/bin/bash

# Auto-detect language and run code
# Usage: ./auto-run.sh <file> [cpp_version]

FILE="$1"
CPP_VERSION="${2:-c++20}"  # Default to C++20

if [ -z "$FILE" ]; then
    echo "Usage: $0 <file> [cpp_version]"
    echo "Example: $0 solution.cpp c++17"
    exit 1
fi

if [ ! -f "$FILE" ]; then
    echo "Error: File '$FILE' not found"
    exit 1
fi

# Get file extension
EXT="${FILE##*.}"
BASENAME="${FILE%.*}"
DIRNAME=$(dirname "$FILE")

echo "========================================="
echo "Auto Run Script"
echo "File: $FILE"
echo "Extension: $EXT"
echo "========================================="
echo ""

case "$EXT" in
    cpp|cc|cxx)
        echo "Detected: C++ file"
        echo "Compiling with g++ -std=$CPP_VERSION..."
        echo ""
        
        if g++ -std="$CPP_VERSION" -Wall -Wextra -O2 "$FILE" -o "$BASENAME"; then
            echo ""
            echo "✓ Compilation successful!"
            echo "========================================="
            echo "Running program..."
            echo "========================================="
            echo ""
            
            # Check if input.txt exists
            if [ -f "$DIRNAME/input.txt" ]; then
                echo "Using input from input.txt"
                echo ""
                "$BASENAME" < "$DIRNAME/input.txt"
            else
                "$BASENAME"
            fi
            
            EXIT_CODE=$?
            echo ""
            echo "========================================="
            echo "Program exited with code: $EXIT_CODE"
            echo "========================================="
            
            # Clean up executable
            rm -f "$BASENAME"
        else
            echo ""
            echo "✗ Compilation failed!"
            exit 1
        fi
        ;;
        
    c)
        echo "Detected: C file"
        echo "Compiling with gcc..."
        echo ""
        
        if gcc -Wall -Wextra -O2 "$FILE" -o "$BASENAME"; then
            echo ""
            echo "✓ Compilation successful!"
            echo "========================================="
            echo "Running program..."
            echo "========================================="
            echo ""
            
            if [ -f "$DIRNAME/input.txt" ]; then
                echo "Using input from input.txt"
                echo ""
                "$BASENAME" < "$DIRNAME/input.txt"
            else
                "$BASENAME"
            fi
            
            EXIT_CODE=$?
            echo ""
            echo "========================================="
            echo "Program exited with code: $EXIT_CODE"
            echo "========================================="
            
            rm -f "$BASENAME"
        else
            echo ""
            echo "✗ Compilation failed!"
            exit 1
        fi
        ;;
        
    py)
        echo "Detected: Python file"
        echo "Running with python3..."
        echo "========================================="
        echo ""
        
        if [ -f "$DIRNAME/input.txt" ]; then
            echo "Using input from input.txt"
            echo ""
            python3 "$FILE" < "$DIRNAME/input.txt"
        else
            python3 "$FILE"
        fi
        
        EXIT_CODE=$?
        echo ""
        echo "========================================="
        echo "Program exited with code: $EXIT_CODE"
        echo "========================================="
        ;;
        
    java)
        echo "Detected: Java file"
        echo "Compiling with javac..."
        echo ""
        
        if javac "$FILE"; then
            echo ""
            echo "✓ Compilation successful!"
            echo "========================================="
            echo "Running program..."
            echo "========================================="
            echo ""
            
            CLASS_NAME=$(basename "$BASENAME")
            
            if [ -f "$DIRNAME/input.txt" ]; then
                echo "Using input from input.txt"
                echo ""
                java -cp "$DIRNAME" "$CLASS_NAME" < "$DIRNAME/input.txt"
            else
                java -cp "$DIRNAME" "$CLASS_NAME"
            fi
            
            EXIT_CODE=$?
            echo ""
            echo "========================================="
            echo "Program exited with code: $EXIT_CODE"
            echo "========================================="
            
            # Clean up class files
            rm -f "$DIRNAME"/*.class
        else
            echo ""
            echo "✗ Compilation failed!"
            exit 1
        fi
        ;;
        
    go)
        echo "Detected: Go file"
        echo "Running with go run..."
        echo "========================================="
        echo ""
        
        if [ -f "$DIRNAME/input.txt" ]; then
            echo "Using input from input.txt"
            echo ""
            go run "$FILE" < "$DIRNAME/input.txt"
        else
            go run "$FILE"
        fi
        
        EXIT_CODE=$?
        echo ""
        echo "========================================="
        echo "Program exited with code: $EXIT_CODE"
        echo "========================================="
        ;;
        
    rs)
        echo "Detected: Rust file"
        echo "Compiling with rustc..."
        echo ""
        
        if rustc "$FILE" -o "$BASENAME"; then
            echo ""
            echo "✓ Compilation successful!"
            echo "========================================="
            echo "Running program..."
            echo "========================================="
            echo ""
            
            if [ -f "$DIRNAME/input.txt" ]; then
                echo "Using input from input.txt"
                echo ""
                "$BASENAME" < "$DIRNAME/input.txt"
            else
                "$BASENAME"
            fi
            
            EXIT_CODE=$?
            echo ""
            echo "========================================="
            echo "Program exited with code: $EXIT_CODE"
            echo "========================================="
            
            rm -f "$BASENAME"
        else
            echo ""
            echo "✗ Compilation failed!"
            exit 1
        fi
        ;;
        
    js)
        echo "Detected: JavaScript file"
        echo "Running with node..."
        echo "========================================="
        echo ""
        
        if [ -f "$DIRNAME/input.txt" ]; then
            echo "Using input from input.txt"
            echo ""
            node "$FILE" < "$DIRNAME/input.txt"
        else
            node "$FILE"
        fi
        
        EXIT_CODE=$?
        echo ""
        echo "========================================="
        echo "Program exited with code: $EXIT_CODE"
        echo "========================================="
        ;;
        
    *)
        echo "Error: Unsupported file type: .$EXT"
        echo "Supported types: .cpp, .c, .py, .java, .go, .rs, .js"
        exit 1
        ;;
esac

