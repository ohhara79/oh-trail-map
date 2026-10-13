#!/bin/sh

npm run build
B=s3://gwanaksan-ohhara-ai

# Tiles: rarely change, cache for a week
#aws s3 sync dist/data $B/data --delete --cache-control "public,max-age=604800"

# Hashed JS/CSS: filenames change on every build, so cache forever
aws s3 sync dist/assets $B/assets --delete --cache-control "public,max-age=31536000,immutable"

aws s3 cp dist/og.png $B/og.png --cache-control "public,max-age=604800"
aws s3 cp dist/robots.txt $B/robots.txt --cache-control "public,max-age=86400"
aws s3 cp dist/favicon.ico $B/favicon.ico --cache-control "public,max-age=604800"
aws s3 cp dist/icon.svg $B/icon.svg --content-type "image/svg+xml" --cache-control "public,max-age=604800"
aws s3 cp dist/apple-touch-icon.png $B/apple-touch-icon.png --cache-control "public,max-age=604800"

# The page: browsers always revalidate it, so a new release shows up right away
aws s3 cp dist/index.html $B/index.html --cache-control "no-cache"
