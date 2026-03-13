# IT Asset Management Backend

A robust Node.js/Express.js backend API for managing IT assets with MongoDB database, featuring user authentication, bulk Excel uploads, and auto-generated sequential serial numbers.

## Features

- RESTful API for IT asset management
- User authentication (Signup, Login, Password Reset)
- MongoDB database with Mongoose ODM
- Auto-generated sequential serial numbers (PREFIX-DDMMYYYY-XXX format)
- Bulk Excel/CSV upload with flexible column mapping
- Input validation with express-validator
- Error handling middleware
- Pagination, filtering, and sorting
- Soft delete functionality
- Asset statistics and analytics
- Export assets functionality
- Health check endpoints
- CORS enabled for frontend integration

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: bcryptjs for password hashing
- **Validation**: express-validator
- **File Upload**: multer + xlsx
- **Security**: helmet, cors

## Project Structure

`
IT_backend/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection with DNS fix for Atlas
│   │   ├── environment.js       # Environment variables config
│   │   └── index.js             # Config exports
│   │
│   ├── controllers/
│   │   ├── asset.controller.js  # Asset CRUD, bulk upload, stats, export
│   │   └── auth.controller.js   # Signup, login, password reset
│   │
│   ├── middleware/
│   │   ├── validators/
│   │   │   └── asset.validator.js  # Request validation rules
│   │   ├── errorHandler.js      # Global error handling
│   │   └── notFound.js          # 404 handler
│   │
│   ├── models/
│   │   ├── Asset.model.js       # Asset schema with indexes
│   │   └── User.model.js        # User schema with password hashing
│   │
│   ├── routes/
│   │   ├── asset.routes.js      # Asset API routes
│   │   ├── auth.routes.js       # Authentication routes
│   │   └── health.routes.js     # Health check routes
│   │
│   ├── app.js                   # Express app configuration
│   └── server.js                # Server entry point
│
├── .env                         # Environment variables (not in git)
├── .gitignore
├── package.json
└── README.md
`

## Database Models

### Asset Model
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| serialNumber | String | Yes | Auto-generated unique ID (e.g., OMT-13032026-001) |
| companyName | String | No | Company name (default: NA) |
| branch | String | No | Branch location (default: NA) |
| department | String | No | Department name (default: NA) |
| userName | String | No | Assigned user (default: NA) |
| brand | String | No | Device brand (default: NA) |
| device | Enum | No | Device type (Desktop, Laptop, etc.) |
| deviceSerialNo | String | No | Device serial number (default: NA) |
| operatingSystem | String | No | OS name (default: NA) |
| dateOfPurchase | Date | No | Purchase date (default: current date) |
| remark | String | No | Additional notes (max 500 chars) |
| status | Enum | No | Active, Inactive, Under Maintenance, Disposed, Lost |
| isDeleted | Boolean | No | Soft delete flag (default: false) |
| createdBy | ObjectId | Yes | Reference to User who created the asset |

### User Model
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | String | Yes | Unique username (lowercase) |
| name | String | Yes | Full name |
| role | Enum | No | admin, manager, user (default: user) |
| password | String | Yes | Hashed password (min 6 chars) |

## API Endpoints

### Base URL: /api/v1

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Check server health |

### Authentication /api/v1/auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /signup | Register new user |
| POST | /login | User login |
| POST | /reset-password | Reset user password |

### Assets /api/v1/assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Get all assets (with pagination, filters, search) |
| POST | / | Create new asset |
| GET | /:id | Get asset by ID |
| PUT | /:id | Update asset |
| DELETE | /:id | Soft delete asset |
| DELETE | /:id/permanent | Permanently delete asset |
| GET | /serial/:serialNumber | Get asset by serial number |
| GET | /stats/overview | Get asset statistics |
| GET | /filters | Get available filter options |
| GET | /export | Export assets data |
| GET | /generate-serial/:companyName | Generate next serial number |
| POST | /bulk | Bulk create assets (JSON) |
| POST | /upload-excel | Upload Excel/CSV file |

## Serial Number Format

Serial numbers are auto-generated in the format: PREFIX-DDMMYYYY-XXX

| Company Name | Prefix | Example |
|--------------|--------|---------|
| OmTrans | OMT | OMT-13032026-001 |
| TGL | TGL | TGL-13032026-001 |
| OmTrax | OMX | OMX-13032026-001 |
| Others | First 3 letters | ABC-13032026-001 |

- Sequence is unique per company prefix (continues across all dates)
- Auto-increments: 001, 002, 003...

## Query Parameters

### Pagination and Sorting
| Parameter | Default | Description |
|-----------|---------|-------------|
| page | 1 | Page number |
| limit | 20 | Items per page (max 100) |
| sortBy | createdAt | Sort field |
| order | desc | Sort order (asc/desc) |

### Filters
| Parameter | Description |
|-----------|-------------|
| search | Global search across multiple fields |
| companyName | Filter by company (comma-separated for multiple) |
| branch | Filter by branch |
| department | Filter by department |
| status | Filter by status |
| device | Filter by device type |
| brand | Filter by brand |
| dateFrom | Filter from date |
| dateTo | Filter to date |

## Excel Upload

Supports flexible column mapping for bulk uploads:

### Accepted Column Names
| Field | Accepted Headers |
|-------|------------------|
| companyName | Company Name, Company, Organization |
| branch | Branch, Location, Site, Office |
| department | Department, Dept, Division |
| userName | User Name, User, Employee Name, Assigned To |
| brand | Brand, Make, Manufacturer |
| device | Device, Device Type, Type, Category |
| deviceSerialNo | Device Serial No, Device S.No, Serial No |
| dateOfPurchase | Date of Purchase, Purchase Date, Date |
| operatingSystem | OS, Operating System |
| remark | Remark, Remarks, Notes, Comment |
| status | Status, State, Condition |

**Notes:**
- Empty cells are auto-filled with NA
- Serial numbers are auto-generated if not provided
- Date defaults to current date if not provided
- Status defaults to Active
- Maximum 5000 records per upload

## Installation

1. Clone the repository:
`ash
git clone <repository-url>
cd IT_backend
`

2. Install dependencies:
`ash
npm install
`

3. Configure environment variables:
`ash
cp .env.example .env
`

4. Start the server:
`ash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/it_assets_db |
| CORS_ORIGIN | Allowed CORS origin | * |

## License

ISC
