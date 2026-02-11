# IT Asset Management Backend

A Node.js/Express.js backend API for managing IT assets with MongoDB database.

## Features

- RESTful API for IT asset management
- MongoDB database with Mongoose ODM
- Input validation with express-validator
- Error handling middleware
- Pagination, filtering, and sorting
- Soft delete functionality
- Asset statistics and analytics
- Bulk operations support
- Health check endpoints

## Project Structure

```
IT_backend/
├── src/
│   ├── config/
│   │   ├── database.js       # MongoDB connection
│   │   ├── environment.js    # Environment variables
│   │   └── index.js
│   ├── controllers/
│   │   ├── asset.controller.js
│   │   └── index.js
│   ├── middleware/
│   │   ├── validators/
│   │   │   └── asset.validator.js
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   └── index.js
│   ├── models/
│   │   ├── Asset.model.js
│   │   └── index.js
│   ├── routes/
│   │   ├── asset.routes.js
│   │   ├── health.routes.js
│   │   └── index.js
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── asyncHandler.js
│   │   ├── constants.js
│   │   └── index.js
│   ├── app.js
│   └── server.js
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. Clone the repository or navigate to the project directory:
   ```bash
   cd IT_backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the values as needed

4. Start MongoDB (if not running):
   ```bash
   mongod
   ```

5. Start the server:
   ```bash
   # Development mode with hot reload
   npm run dev

   # Production mode
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/it_assets_db |
| CORS_ORIGIN | Allowed CORS origin | http://localhost:3000 |
| API_PREFIX | API route prefix | /api/v1 |

## API Endpoints

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/assets | Get all assets (with pagination) |
| GET | /api/v1/assets/:id | Get asset by ID |
| GET | /api/v1/assets/serial/:serialNumber | Get asset by serial number |
| POST | /api/v1/assets | Create new asset |
| PUT | /api/v1/assets/:id | Update asset |
| DELETE | /api/v1/assets/:id | Soft delete asset |
| DELETE | /api/v1/assets/:id/permanent | Permanently delete asset |
| GET | /api/v1/assets/stats/overview | Get asset statistics |
| POST | /api/v1/assets/bulk | Bulk create assets |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/health | API health check |
| GET | /api/v1/health/db | Database health check |

## Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

### Filtering
- `company` - Filter by company
- `branch` - Filter by branch
- `department` - Filter by department
- `status` - Filter by status
- `device` - Filter by device type
- `user` - Filter by user (partial match)
- `search` - Search in serial number, user, device serial number, brand

### Sorting
- `sortBy` - Field to sort by (default: createdAt)
- `order` - Sort order: asc or desc (default: desc)

## Asset Model

```javascript
{
  serialNumber: String (required, unique),
  company: String (required),
  branch: String (required),
  department: String (required),
  user: String (required),
  brand: String (required),
  device: String (required, enum),
  deviceSerialNumber: String (required),
  operatingSystem: String,
  purchaseDate: Date (required),
  remarks: String,
  status: String (enum: Active, Inactive, Under Maintenance, Disposed, Lost),
  isDeleted: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Device Types

- Desktop
- Laptop
- Tablet
- Monitor
- Printer
- Scanner
- Server
- Network Device
- Other

## Example Requests

### Create Asset
```bash
curl -X POST http://localhost:5000/api/v1/assets \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "IT-2024-001",
    "company": "TechCorp",
    "branch": "Main Office",
    "department": "Engineering",
    "user": "John Doe",
    "brand": "Dell",
    "device": "Laptop",
    "deviceSerialNumber": "DELL-XPS-123456",
    "operatingSystem": "Windows 11 Pro",
    "purchaseDate": "2024-01-15",
    "remarks": "Developer workstation"
  }'
```

### Get Assets with Filtering
```bash
curl "http://localhost:5000/api/v1/assets?company=TechCorp&department=Engineering&page=1&limit=10"
```

## Future Enhancements

The project structure is ready for:
- Authentication (JWT)
- Role-based access control (RBAC)
- File uploads for asset images
- Audit logging
- Email notifications
- Export functionality (CSV, PDF)

## License

ISC
