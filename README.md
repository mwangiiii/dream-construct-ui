# Dream Construct UI

## What is this codebase?

Dream Construct UI is a comprehensive web application designed for construction companies and project managers. It provides tools for managing projects, finances, teams, media galleries, reviews, and more. The codebase is built with modern web technologies and follows a modular architecture for scalability and maintainability.

### Architecture Overview

- **Frontend:** Built with React and TypeScript, using Vite for fast development and Tailwind CSS for responsive design.
- **Components:** Modular UI components for navigation, dashboards, popups, and forms.
- **Pages:** Route-based pages for core business functions (Projects, Finance, Team, Contact, etc.).
- **Hooks & Utilities:** Custom hooks and utility functions to streamline state management and API interactions.
- **API Integration:** Uses Supabase for authentication, database, and serverless functions.
- **Database:** SQL migrations and Supabase functions for backend logic and data storage.
- **Assets:** Organized static files and media for easy access and management.

### Main Features

- Project management: Track milestones, updates, approvals, and issues
- Finance tracking: Manage accounts, balance sheets, cash flow, and reconciliation
- Team and worker management: Assignments, attendance, and roles
- Media gallery: Upload and organize project photos and documents
- Reviews and feedback: Collect and display client and staff reviews
- Authentication: Secure login, registration, and password management
- Responsive UI: Works seamlessly across devices

This codebase is ideal for construction businesses seeking a digital platform to streamline operations, improve collaboration, and enhance transparency.

...existing code...

# Dream Construct UI

This is a modern construction website built with React, TypeScript, Vite, Tailwind CSS, and Supabase. It features modular components, project management, finance tracking, media galleries, and more.

## Project Structure

- **src/**: Main application code
  - **pages/**: Route-based pages (e.g., Projects, Finance, Team, Contact, etc.)
  - **components/**: Reusable UI and layout components
  - **api/**: Client-side API utilities
  - **lib/**: Auth, Supabase client, and utility functions
  - **hooks/**: Custom React hooks
  - **types/**: TypeScript type definitions
- **supabase/**: Serverless functions and SQL migrations for backend/database
- **public/**: Static assets

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm (comes with Node.js)
- [Supabase account](https://supabase.com/) (for backend features)

### Setup

1. Clone the repository:
	```sh
	git clone <YOUR_GIT_URL>
	cd dream-construct-ui
	```
2. Install dependencies:
	```sh
	npm install
	```
3. Configure environment variables:
	- Create a `.env` file if needed for Supabase keys and other secrets.
4. Start the development server:
	```sh
	npm run dev
	```
5. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

- Modular React components for construction business workflows
- Project, finance, and team management
- Media gallery and reviews
- Authentication and Supabase integration
- Responsive UI with Tailwind CSS

## Deployment

- Deploy with [Vercel](https://vercel.com/) or any static hosting provider
- For backend, deploy Supabase functions and migrations as needed
- Optionally, use Lovable or GitHub Codespaces for cloud development

## Contribution

1. Fork the repo and create a new branch
2. Make your changes
3. Run `npm run lint` and `npm run build` to check for errors
4. Submit a pull request

## License

MIT
