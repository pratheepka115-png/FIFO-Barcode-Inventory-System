# FIFO Barcode Inventory System

A warehouse inventory management system designed to support First-In, First-Out (FIFO) stock handling using barcode scanning and inventory tracking.

## Features

- Inventory batch management
- Barcode scanning support
- Inbound stock intake
- FIFO-based outbound stock handling
- Warehouse floor map
- Inventory dashboard
- Expiry and shelf-life tracking

## Technology Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js and Express
- Database: MySQL
- Desktop application: Electron

## Getting Started

### Prerequisites

- Node.js and npm
- MySQL Server
- Git

### Installation

1. Clone the repository:

   `git clone https://github.com/pratheepka115-png/FIFO-Barcode-Inventory-System.git`

2. Open the project directory:

   `cd FIFO-Barcode-Inventory-System`

3. Install the frontend dependencies:

   `npm install`

4. Configure your local environment variables using the project's backend configuration requirements. Do not commit passwords or API keys.

5. Start the frontend development server:

   `npm run dev`

6. Start the backend using the script and instructions configured in the `server` directory.

### Database Setup

1. Start MySQL Server.
2. Create or select the required project database.
3. Configure the database connection in your local environment file.
4. Create the required tables using the project's SQL scripts, if provided.

## Security

- Keep `.env` files and database credentials private.
- Do not upload customer or production data.
- Store secrets in environment variables.

## Project Structure

- `src/` — Frontend source code
- `server/` — Backend source code
- `package.json` — Project scripts and dependencies
- `README.md` — Project documentation

## License

No license has been specified yet.