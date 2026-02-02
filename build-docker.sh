#!/bin/bash

# Check if a folder name is provided
if [ -z "$1" ]; then
  echo "Usage: $0 name"
  exit 1
fi

# Set variables
NAME=$1
GCP_REGION="us-west1"
GCP_PROJECT="snyk-cx-se-demo"
GCP_ARTIFACT_REGISTRY="ctf-images"

IMAGE_NAME=$GCP_REGION"-docker.pkg.dev/$GCP_PROJECT/$GCP_ARTIFACT_REGISTRY/$NAME:latest"



# Build the Docker image
docker build --no-cache --platform linux/amd64 -t "$IMAGE_NAME" .

# Output the image name
echo "Docker image built: $IMAGE_NAME"