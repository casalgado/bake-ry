# Product Report System

## Overview

The Product Report system generates table-friendly product performance data from order history. It supports filtering by categories, date ranges, time periods, and customer segments (B2B/B2C).

## API Endpoint

```
GET /bakeries/:bakeryId/orders/product_report
```

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `categories` | string | all | Comma-separated collectionIds to filter products |
| `start_date` | YYYY-MM-DD | Jan 1 (current year) | Start of date range |
| `end_date` | YYYY-MM-DD | Today | End of date range |
| `date_field` | string | `dueDate` | Which order date field to use (`dueDate`, `paymentDate`, etc.) |
| `period` | string | none | Group data by period: `daily`, `weekly`, `monthly` |
| `metrics` | string | `both` | Which metrics to show: `ingresos`, `cantidad`, or `both` |
| `segment` | string | `none` | Customer segment: `none`, `all`, `b2b`, `b2c` |

### Segment Options Explained

| Value | Behavior |
|-------|----------|
| `none` | Show combined totals only |
| `all` | Show Total + B2B + B2C breakdown columns |
| `b2b` | Filter to show only B2B customer orders |
| `b2c` | Filter to show only B2C customer orders |

## Response Structure

### Basic Response (segment=none)

```json
{
  "metadata": {
    "options": {
      "categories": ["collectionId1", "collectionId2"],
      "period": "monthly",
      "metrics": "both",
      "segment": "none",
      "dateField": "dueDate",
      "defaultDateRangeApplied": true
    },
    "totalOrders": 150,
    "dateRange": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-11-27T00:00:00.000Z"
    },
    "totalProducts": 25,
    "currency": "COP"
  },
  "products": [
    {
      "categoryId": "GRzDxeAWOj2HBhmlObSy",
      "categoryName": "sourdough",
      "productId": "zXHgfeYE4dqWP6XuqV34",
      "productName": "original",
      "avgPrice": 22500,
      "totalIngresos": 450000,
      "totalCantidad": 20,
      "periods": {
        "2025-01": { "ingresos": 150000, "cantidad": 7 },
        "2025-02": { "ingresos": 200000, "cantidad": 9 },
        "2025-03": { "ingresos": 100000, "cantidad": 4 }
      }
    }
  ],
  "summary": {
    "totals": {
      "totalIngresos": 5000000,
      "totalCantidad": 500
    },
    "byCategory": [
      {
        "categoryId": "GRzDxeAWOj2HBhmlObSy",
        "categoryName": "sourdough",
        "totalIngresos": 3000000,
        "totalCantidad": 300
      }
    ]
  }
}
```

### Response with B2B/B2C Breakdown (segment=all)

When `segment=all`, each product includes B2B/B2C breakdown in both totals and per-period data:

```json
{
  "products": [
    {
      "categoryId": "GRzDxeAWOj2HBhmlObSy",
      "categoryName": "sourdough",
      "productId": "zXHgfeYE4dqWP6XuqV34",
      "productName": "original",
      "avgPrice": 22500,
      "totalIngresos": 450000,
      "totalCantidad": 20,
      "b2bIngresos": 300000,
      "b2bCantidad": 12,
      "b2cIngresos": 150000,
      "b2cCantidad": 8,
      "periods": {
        "2025-01": {
          "ingresos": 150000,
          "cantidad": 7,
          "b2bIngresos": 100000,
          "b2bCantidad": 5,
          "b2cIngresos": 50000,
          "b2cCantidad": 2
        },
        "2025-02": {
          "ingresos": 200000,
          "cantidad": 9,
          "b2bIngresos": 120000,
          "b2bCantidad": 5,
          "b2cIngresos": 80000,
          "b2cCantidad": 4
        }
      }
    }
  ],
  "summary": {
    "totals": {
      "totalIngresos": 5000000,
      "totalCantidad": 500,
      "b2bIngresos": 3500000,
      "b2bCantidad": 350,
      "b2cIngresos": 1500000,
      "b2cCantidad": 150
    }
  }
}
```

## Architecture

### Files

```
src/
├── models/
│   └── ProductReport.js      # Core report logic
├── services/
│   └── orderService.js       # getProductReport method
├── controllers/
│   └── orderController.js    # API controller
└── routes/
    └── orderRoutes.js        # Route definition
```

### Data Flow

```
1. Request arrives at /orders/product_report
           ↓
2. Controller parses query params via QueryParser
           ↓
3. Service extracts report-specific options (categories, period, metrics, segment)
           ↓
4. Service removes these from query (they don't exist on Order documents)
           ↓
5. Service applies default date range if none provided (current year)
           ↓
6. Service fetches: orders, products, b2b_clients from Firestore
           ↓
7. ProductReport model aggregates data:
   - Filters complimentary orders
   - Filters by segment (b2b/b2c) if specified
   - Aggregates products from orderItems
   - Filters by categories
   - Groups by period if specified
           ↓
8. Returns structured report
```

### Key Design Decisions

1. **Category filtering in memory**: Categories are nested inside `orderItems`, so Firestore can't filter by them. We fetch orders and filter in the ProductReport model.

2. **Default date range**: To prevent fetching all historical data, defaults to current year (Jan 1 to today) if no dates provided.

3. **Products with zero sales included**: Active products that haven't sold in the period are shown with 0 values, useful for identifying non-selling items.

4. **Deleted products with sales included**: If a deleted product has sales in the period, it's still shown in the report.

## Example Queries

```bash
# Basic report (current year, all products)
GET /bakeries/es-alimento/orders/product_report

# Specific category
GET /bakeries/es-alimento/orders/product_report?categories=GRzDxeAWOj2HBhmlObSy

# Date range with monthly trends
GET /bakeries/es-alimento/orders/product_report?start_date=2025-01-01&end_date=2025-06-30&period=monthly

# B2B vs B2C breakdown
GET /bakeries/es-alimento/orders/product_report?segment=all

# Only B2B sales, revenue only
GET /bakeries/es-alimento/orders/product_report?segment=b2b&metrics=ingresos

# Weekly trends for specific categories
GET /bakeries/es-alimento/orders/product_report?categories=GRzDxeAWOj2HBhmlObSy,jSuTNbAyUtHSVbMIcfXq&period=weekly&start_date=2025-01-01&end_date=2025-01-31
```

## Period Key Formats

| Period | Format | Example |
|--------|--------|---------|
| `daily` | `YYYY-MM-DD` | `2025-01-15` |
| `weekly` | `YYYY-MM-DD/YYYY-MM-DD` | `2025-01-13/2025-01-19` (Mon-Sun) |
| `monthly` | `YYYY-MM` | `2025-01` |

## Testing

Tests are located at `src/__tests__/models/ProductReport.test.js`

```bash
npm test -- src/__tests__/models/ProductReport.test.js
```

51 tests covering:
- Constructor and options
- Segment filtering
- Report generation
- Period calculations
- Category filtering
- Edge cases (empty data, deleted products, etc.)
