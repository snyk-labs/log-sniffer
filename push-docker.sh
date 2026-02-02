#!/bin/bash

# Check if a folder name is provided
if [ -z "$1" ]; then
  echo "Usage: $0 name"
  exit 1
fi

# Set variables
NAME=$1
IMAGE_NAME="us-west1-docker.pkg.dev/snyk-cx-se-demo/ctf-images/$NAME:latest"

# Push the Docker image
docker push "$IMAGE_NAME"

# Output the image name
echo "Docker image pushed: $IMAGE_NAME"