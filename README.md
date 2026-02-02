<p align="center">
  <img src="client/public/favicon.png" alt="LogSniffer Logo" width="150">
</p>

# LogSniffer - Snyk Audit Log Dashboard

## Overview

LogSniffer is a full-stack web application that provides a security-focused dashboard for analyzing Snyk audit logs. The application integrates with Snyk's API to fetch audit log data and uses Google's Gemini AI to provide intelligent insights and recommendations about security events. Built with React, Express, and PostgreSQL, it offers real-time audit log monitoring, AI-powered analysis, and an interactive chat interface for security insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18 or later recommended)
- npm (comes with Node.js)
- Git

### Install dependencies

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd log-sniffer
    ```

2.  **Install dependencies:**
    This command will install all the necessary packages for both the client and server.
    ```bash
    npm install
    ```

3. Environment Variables

    The application requires some environment variables to connect to Snyk, Google AI, and the database.
    1.  Create a file named `.env` in the root directory of the project.
    2.  Add the following variables to the `.env` file, replacing the placeholder values with your actual credentials:
            ```env
            # Snyk API Token
            SNYK_API_TOKEN=your_snyk_api_token

            # Google Gemini API Key
            GEMINI_API_KEY=your_gemini_api_key
            ```

4. Run the Application

    To start the development server, run the following command from the root directory:

    ```bash
    npm run dev
    ```

    This will start both the backend server and the frontend Vite development server. You can access the application in your browser at `http://localhost:5000`.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript in a Vite-based build system
- **UI Library**: Radix UI components with shadcn/ui design system implementation
- **Styling**: Tailwind CSS with Snyk's 2025 brand colors and design tokens
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with structured error handling
- **Development Server**: Vite middleware integration for hot module replacement
- **Request Logging**: Custom middleware for API request/response logging

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon Database serverless PostgreSQL adapter
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Storage Strategy**: Hybrid approach with in-memory storage for development and PostgreSQL for production

### Authentication & Security
- **API Integration**: Snyk API token-based authentication
- **Session Management**: PostgreSQL-backed session storage with connect-pg-simple
- **Configuration Management**: Environment-based API token and connection string management

### External Dependencies

#### Third-Party Services
- **Snyk API**: Core integration for fetching audit logs, organizations, and groups data
- **Google Gemini AI**: AI-powered analysis and chat functionality for security insights
- **Neon Database**: Serverless PostgreSQL hosting and management

#### Key Libraries & Frameworks
- **Database**: Drizzle ORM, @neondatabase/serverless, connect-pg-simple
- **AI/ML**: @google/genai for Gemini API integration
- **UI Components**: Comprehensive Radix UI primitive collection
- **State Management**: @tanstack/react-query for server state caching
- **Validation**: Zod schemas with drizzle-zod integration
- **Utilities**: date-fns for date manipulation, clsx and tailwind-merge for styling

#### Development Tools
- **Build System**: Vite with React plugin and TypeScript support
- **Code Quality**: TypeScript for type safety across the full stack
- **Development Experience**: Replit-specific plugins for error overlay and cartographer

The application follows a modern full-stack architecture with clear separation of concerns, type safety throughout, and integration with external security and AI services to provide comprehensive audit log analysis capabilities.

## Recent Changes

### Executive Summary Feature (August 13, 2025)
- **Auto-Generated Executive Summaries**: When audit data is fetched, the system automatically generates executive summaries for AppSec and Engineering leaders
- **Real-Time Data Analysis**: Executive summaries fetch fresh data directly from Snyk API for the last 24 hours (up to 500 logs)
- **Leadership-Focused Content**: Summaries include Executive Overview, Critical Events, Risk Analysis, User Activity, Recommendations, and Metrics
- **Download/Copy Functionality**: Summaries can be downloaded as text files or copied to clipboard for leadership reports
- **Persistent Display**: Executive summaries remain visible in the chat interface and don't disappear when new messages are added
- **Enhanced UI**: Green-themed design distinguishes executive summaries from regular chat messages with dedicated file icons and action buttons

### UI Updates (August 13, 2025)
- **Title Change**: Updated main application title from "Snyk Audit Log Dashboard" to "Log Sniffer"  
- **Icon Update**: Changed title icon from shield (🛡️) to magnifying glass emoji (🔍) for better alignment with "sniffer" concept
- **Chat Interface**: Removed message icon from "Security Analyst AI" header for cleaner design
- **Dialog Fix**: Removed duplicate close button ("extra x") from audit log details dialog - now uses only the built-in shadcn/ui dialog close button
- **Markdown Enhancement**: Added proper Markdown rendering for executive summaries with custom green-themed styling and React Markdown components

### Technical Fixes (August 13, 2025)
- **Gemini API Fix**: Updated Gemini AI API call structure to use proper contents array format for SDK compatibility
- **Executive Summary Persistence**: Fixed issue where executive summaries would disappear when new chat messages were added
