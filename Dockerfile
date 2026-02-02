# Use the official Node.js v20 LTS image
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Set environment variable to indicate we're running in Docker
ENV DOCKER=true

# Expose the port your application runs on
EXPOSE 5000

# Define the command to run your application
CMD ["npm", "run", "dev"]