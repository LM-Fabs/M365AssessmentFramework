#!/bin/bash

# Convert all Azure Functions from v4 to v3 syntax
echo "Converting Azure Functions from v4 to v3 syntax..."

# Find all function directories
for dir in */; do
    if [ -f "$dir/index.ts" ] && [ -f "$dir/function.json" ]; then
        echo "Converting $dir..."
        
        # Replace v4 imports with v3 compatible
        sed -i '' 's/import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure\/functions";/\/\/ v3 compatible imports/g' "$dir/index.ts"
        
        # Replace v4 function syntax with v3 default export
        sed -i '' 's/export async function [a-zA-Z]*(/export default async function (/g' "$dir/index.ts"
        sed -i '' 's/: Promise<HttpResponseInit>/: Promise<void>/g' "$dir/index.ts"
        
        # Replace context and request parameters
        sed -i '' 's/(req: HttpRequest, context: InvocationContext)/(context: any, req: any)/g' "$dir/index.ts"
        sed -i '' 's/(request: HttpRequest, context: InvocationContext)/(context: any, req: any)/g' "$dir/index.ts"
        
        # Replace return statements with context.res
        sed -i '' 's/return {/context.res = {/g' "$dir/index.ts"
        sed -i '' 's/return;/return;/g' "$dir/index.ts"
        
        echo "Converted $dir"
    fi
done

echo "Conversion complete!"
